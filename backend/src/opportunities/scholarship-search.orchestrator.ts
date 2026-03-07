import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { runTinyfishWithFallback } from '../tinyfish/tinyfish.client'
import { JobSearchRunStore, SearchRunResultItem } from './job-search-run.store'
import { getActiveScholarshipDiscoveryDomains, ScholarshipSourceScope } from './scholarship-source-registry'
import { ValyuDiscoveredScholarshipCandidate, ValyuSearchService } from './valyu-search.service'

type StartScholarshipSearchRunInput = {
  userId: string
  query: string
  maxNumResults: number
  sourceScope: ScholarshipSourceScope
}

type TinyfishScholarshipRecord = {
  title?: string
  provider?: string
  destination?: string
  deadline?: string
  study_level?: string
  funding_type?: string
  match_reason?: string
  summary?: string
  snippet?: string
  eligibility?: string[]
  application_steps?: string[]
  benefits?: string[]
}

const ENRICH_CONCURRENCY = Math.min(4, Math.max(1, Number(process.env.SCHOLARSHIP_ENRICH_CONCURRENCY || 3)))
const EXTRACT_CACHE_TTL_MS = Number(process.env.JOB_EXTRACT_CACHE_TTL_MS || 24 * 60 * 60_000)

@Injectable()
export class ScholarshipSearchOrchestrator {
  private readonly logger = new Logger(ScholarshipSearchOrchestrator.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly valyuSearch: ValyuSearchService,
    private readonly runStore: JobSearchRunStore,
  ) {}

  async startRun(input: StartScholarshipSearchRunInput): Promise<{ runId: string }> {
    const normalized = this.normalizeInput(input)
    const intentHash = this.hashKey(`scholarship::${normalized.query}::${normalized.sourceScope}`)
    const activeRun = this.runStore.findActiveRunByIntentHash(intentHash, normalized.userId)
    if (activeRun) {
      return activeRun
    }

    const created = await this.runStore.createRun({
      userId: normalized.userId,
      query: normalized.query,
      queryHash: intentHash,
      intentHash,
      sourceScope: normalized.sourceScope,
    })

    void this.executeRun(created.runId, normalized).catch(async (error: any) => {
      const details = error instanceof Error ? error.message : String(error)
      await this.runStore.appendEvent(created.runId, 'run_error', { message: details })
      await this.runStore.setStatus(created.runId, 'failed')
      this.logger.error(`Scholarship search run failed (${created.runId}): ${details}`)
    })

    return created
  }

  async stopRun(runId: string, userId: string): Promise<boolean> {
    const ok = this.runStore.requestStop(runId, userId)
    if (!ok) return false
    await this.runStore.appendEvent(runId, 'run_stopped', { reason: 'User requested stop' })
    await this.runStore.setStatus(runId, 'stopped')
    return true
  }

  async getSnapshot(runId: string, userId: string): Promise<Record<string, any> | null> {
    return await this.runStore.getSnapshot(runId, userId)
  }

  async getEventsSince(runId: string, userId: string, sequence = 0) {
    return await this.runStore.getEventsSince(runId, userId, sequence)
  }

  private normalizeInput(input: StartScholarshipSearchRunInput): StartScholarshipSearchRunInput {
    return {
      userId: String(input.userId || '').trim(),
      query: String(input.query || '').trim(),
      maxNumResults: Math.max(1, Math.min(10, Number(input.maxNumResults || 10))),
      sourceScope: input.sourceScope || 'global',
    }
  }

  private async executeRun(runId: string, input: StartScholarshipSearchRunInput): Promise<void> {
    await this.runStore.appendEvent(runId, 'run_started', {
      query: input.query,
      sourceScope: input.sourceScope,
      maxNumResults: input.maxNumResults,
      concurrency: ENRICH_CONCURRENCY,
      type: 'scholarship',
    })

    const allowedDomains = getActiveScholarshipDiscoveryDomains(input.sourceScope)
    await this.runStore.appendEvent(runId, 'source_scan_started', {
      sourceScope: input.sourceScope,
      allowedDomains,
      type: 'scholarship',
    })

    const discovered = await this.valyuSearch.discoverScholarshipCandidates({
      query: input.query,
      maxNumResults: Math.min(20, input.maxNumResults * 2),
      includedSources: allowedDomains,
    })

    const uniqueCandidates = discovered.slice(0, input.maxNumResults)
    if (!uniqueCandidates.length) {
      await this.runStore.appendEvent(runId, 'run_completed', {
        total: 0,
        failed: 0,
        type: 'scholarship',
      })
      await this.runStore.setStatus(runId, 'completed')
      return
    }

    for (let index = 0; index < uniqueCandidates.length; index += 1) {
      const candidate = uniqueCandidates[index]
      const queuedItem = this.buildQueuedItem(candidate, index + 1)
      const stored = await this.runStore.upsertResult(runId, queuedItem)
      if (stored?.queueStatus === 'queued') {
        await this.runStore.appendEvent(runId, 'candidate_queued', { result: stored })
      }
    }

    const readyItems: SearchRunResultItem[] = []
    let failedCount = 0
    const queue = [...uniqueCandidates]
    const workers = Array.from({ length: ENRICH_CONCURRENCY }).map(async () => {
      while (queue.length) {
        if (this.runStore.isStopRequested(runId)) return

        const candidate = queue.shift()
        if (!candidate) return

        const queuedItem = this.buildQueuedItem(candidate)
        const extractingItem: SearchRunResultItem = {
          ...queuedItem,
          queueStatus: 'extracting',
        }
        const extractingStored = await this.runStore.upsertResult(runId, extractingItem)
        if (extractingStored?.queueStatus === 'extracting') {
          await this.runStore.appendEvent(runId, 'candidate_extracting', { result: extractingStored })
        }

        try {
          const readyItem = await this.enrichCandidate(candidate)
          if (this.runStore.isStopRequested(runId)) return
          const stored = await this.runStore.upsertResult(runId, readyItem)
          if (!stored) continue
          readyItems.push(stored)
          await this.runStore.appendEvent(runId, 'candidate_ready', { result: stored })
          await this.runStore.appendEvent(runId, 'run_progress', {
            ready: readyItems.length,
            failed: failedCount,
            queued: Math.max(0, queue.length),
          })
        } catch (error: any) {
          if (this.runStore.isStopRequested(runId)) return
          failedCount += 1
          const message = error instanceof Error ? error.message : String(error)
          const failedItem: SearchRunResultItem = {
            ...extractingItem,
            queueStatus: 'failed',
            snippet: extractingItem.snippet || message,
          }
          const stored = await this.runStore.upsertResult(runId, failedItem)
          if (stored?.queueStatus === 'failed') {
            await this.runStore.appendEvent(runId, 'candidate_failed', {
              result: stored,
              message,
            })
          }
          await this.runStore.appendEvent(runId, 'run_progress', {
            ready: readyItems.length,
            failed: failedCount,
            queued: Math.max(0, queue.length),
          })
        }
      }
    })

    await Promise.all(workers)

    if (this.runStore.isStopRequested(runId)) {
      await this.runStore.setStatus(runId, 'stopped')
      return
    }

    await this.runStore.appendEvent(runId, 'run_completed', {
      total: readyItems.length,
      failed: failedCount,
      type: 'scholarship',
    })
    await this.runStore.setStatus(runId, 'completed')
  }

  private buildQueuedItem(candidate: ValyuDiscoveredScholarshipCandidate, queuePosition?: number): SearchRunResultItem {
    const fitScore: SearchRunResultItem['fitScore'] =
      candidate.relevance >= 0.8 ? 'High' : candidate.relevance >= 0.6 ? 'Medium' : 'Low'
    return {
      id: this.hashKey(candidate.url),
      opportunityType: 'scholarship',
      title: candidate.title,
      organization: candidate.sourceName,
      location: 'Global',
      fitScore,
      tags: [candidate.sourceName, 'Scholarship'],
      link: candidate.url,
      status: 'new',
      sourceName: candidate.sourceName,
      sourceDomain: candidate.sourceDomain,
      sourceType: candidate.sourceType,
      sourceVerified: candidate.sourceVerified,
      queueStatus: 'queued',
      queuePosition,
      snippet: candidate.snippet,
      relevance: candidate.relevance,
      isSuspicious: false,
      seenOn: [
        {
          sourceName: candidate.sourceName,
          sourceDomain: candidate.sourceDomain,
          sourceVerified: candidate.sourceVerified,
        },
      ],
    }
  }

  private async enrichCandidate(candidate: ValyuDiscoveredScholarshipCandidate): Promise<SearchRunResultItem> {
    const base = this.buildQueuedItem(candidate)
    const canonicalUrl = this.canonicalizeUrl(candidate.url)
    if (!canonicalUrl) {
      throw new Error('Candidate URL could not be canonicalized for TinyFish extraction.')
    }
    const urlHash = this.hashKey(canonicalUrl)

    const cached = await this.prisma.jobExtractionCache.findUnique({
      where: { canonicalUrlHash: urlHash },
    })
    if (cached && cached.expiresAt.getTime() > Date.now()) {
      const payload = (cached.payload || {}) as TinyfishScholarshipRecord
      return this.buildReadyItem(base, payload)
    }

    const extracted = await this.extractViaTinyfish(canonicalUrl, candidate)
    await this.prisma.jobExtractionCache.upsert({
      where: { canonicalUrlHash: urlHash },
      update: {
        canonicalUrl,
        sourceName: base.sourceName,
        sourceDomain: base.sourceDomain,
        payload: extracted as any,
        expiresAt: new Date(Date.now() + EXTRACT_CACHE_TTL_MS),
      },
      create: {
        canonicalUrlHash: urlHash,
        canonicalUrl,
        sourceName: base.sourceName,
        sourceDomain: base.sourceDomain,
        payload: extracted as any,
        expiresAt: new Date(Date.now() + EXTRACT_CACHE_TTL_MS),
      },
    })

    return this.buildReadyItem(base, extracted)
  }

  private async extractViaTinyfish(
    url: string,
    candidate: ValyuDiscoveredScholarshipCandidate,
  ): Promise<TinyfishScholarshipRecord> {
    const goal = [
      'Open this scholarship listing and extract structured scholarship data.',
      'Return strict JSON only with the schema:',
      JSON.stringify({
        title: 'string',
        provider: 'string',
        destination: 'string',
        deadline: 'string',
        study_level: 'string',
        funding_type: 'string',
        match_reason: 'string',
        summary: 'string',
        snippet: 'string',
        eligibility: ['string'],
        application_steps: ['string'],
        benefits: ['string'],
      }),
      `Search context query: ${candidate.title}`,
      'Use empty strings or empty arrays for unavailable fields.',
    ].join('\n')

    const event = await runTinyfishWithFallback({
      url,
      goal,
      browser_profile: 'stealth',
      proxy_config: { enabled: false },
      feature_flags: { enable_agent_memory: false },
      api_integration: 'tinyfinder-scholarship-search',
    })

    const payload = this.pickFirstRecord(
      event?.resultJson ?? event?.result ?? event?.data?.resultJson ?? event?.data?.result ?? event,
    )
    if (!payload) {
      return {
        summary: '',
        snippet: '',
      }
    }

    return payload
  }

  private pickFirstRecord(input: any): TinyfishScholarshipRecord | null {
    if (!input) return null
    if (typeof input === 'string') {
      try {
        return this.pickFirstRecord(JSON.parse(input))
      } catch {
        return null
      }
    }
    if (Array.isArray(input)) {
      for (const item of input) {
        const parsed = this.pickFirstRecord(item)
        if (parsed) return parsed
      }
      return null
    }
    if (typeof input !== 'object') return null

    const hasSignals = ['title', 'provider', 'destination', 'deadline', 'study_level', 'funding_type', 'summary'].some(
      (key) => key in input,
    )
    if (hasSignals) return input as TinyfishScholarshipRecord

    for (const value of Object.values(input)) {
      const parsed = this.pickFirstRecord(value)
      if (parsed) return parsed
    }
    return null
  }

  private buildReadyItem(base: SearchRunResultItem, payload: TinyfishScholarshipRecord): SearchRunResultItem {
    const title = this.safeText(payload.title) || base.title
    const provider = this.safeText(payload.provider) || base.organization
    const destination = this.safeText(payload.destination) || base.location
    const deadline = this.safeText(payload.deadline)
    const studyLevel = this.safeText(payload.study_level)
    const fundingType = this.safeText(payload.funding_type)
    const snippet = this.safeText(payload.summary || payload.snippet) || base.snippet || ''
    const matchReason = this.safeText(payload.match_reason)
    const requirements = this.safeList(payload.eligibility)
    const responsibilities = this.safeList(payload.application_steps)
    const benefits = this.safeList(payload.benefits)
    const tags = Array.from(new Set([...(base.tags || []), ...(studyLevel ? [studyLevel] : []), ...(fundingType ? [fundingType] : [])]))

    if (!this.isValidScholarshipExtraction({ title, provider, destination, deadline, studyLevel, fundingType, snippet, requirements, responsibilities, benefits })) {
      throw new Error('TinyFish did not extract enough scholarship detail from this page.')
    }

    return {
      ...base,
      opportunityType: 'scholarship',
      title,
      organization: provider,
      location: destination,
      deadline: deadline || undefined,
      studyLevel: studyLevel || undefined,
      fundingType: fundingType || undefined,
      tags,
      snippet,
      matchReason: matchReason || undefined,
      requirements: requirements.length ? requirements : undefined,
      responsibilities: responsibilities.length ? responsibilities : undefined,
      benefits: benefits.length ? benefits : undefined,
      queueStatus: 'ready',
    }
  }

  private isValidScholarshipExtraction(input: {
    title: string
    provider: string
    destination: string
    deadline: string
    studyLevel: string
    fundingType: string
    snippet: string
    requirements: string[]
    responsibilities: string[]
    benefits: string[]
  }): boolean {
    const scholarshipLikeTitle = /\b(scholarship|fellowship|grant|bursary|funding)\b/i.test(input.title)
    const structuredSignals = [
      input.provider,
      input.destination,
      input.deadline,
      input.studyLevel,
      input.fundingType,
      input.snippet,
      input.requirements.length ? 'requirements' : '',
      input.responsibilities.length ? 'responsibilities' : '',
      input.benefits.length ? 'benefits' : '',
    ].filter((value) => String(value || '').trim().length > 0).length

    const looksAdvisory = /\b(applicant advice|application advice|application guide|how to apply|guidance|faq)\b/i.test(
      `${input.title} ${input.snippet}`.trim(),
    )

    return scholarshipLikeTitle && !looksAdvisory && structuredSignals >= 3
  }

  private safeText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
  }

  private safeList(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .slice(0, 10)
  }

  private canonicalizeUrl(url: string): string | null {
    try {
      const parsed = new URL(url)
      parsed.hash = ''
      return parsed.toString()
    } catch {
      return null
    }
  }

  private hashKey(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }
}
