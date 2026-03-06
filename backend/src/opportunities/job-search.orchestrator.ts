import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { runTinyfishWithFallback } from '../tinyfish/tinyfish.client'
import {
  canonicalizeJobUrl,
  deduplicateReadyResults,
  deriveCandidateJobDetails,
  extractedTitleLooksValid,
} from './job-search-candidate.utils'
import { PrismaService } from '../prisma/prisma.service'
import { getActiveDiscoveryDomains, JobSourceScope } from './job-source-registry'
import { JobSearchRunStore, SearchRunResultItem } from './job-search-run.store'
import { ValyuDiscoveredCandidate, ValyuSearchService } from './valyu-search.service'

type StartSearchRunInput = {
  query: string
  countryCode?: string
  maxNumResults: number
  sourceScope: JobSourceScope
  remote?: boolean
  visaSponsorship?: boolean
}

type TinyfishExtractedRecord = {
  title?: string
  company?: string
  location?: string
  salary?: string
  employment_type?: string
  work_mode?: string
  posted_date?: string
  match_reason?: string
  requirements?: string[]
  responsibilities?: string[]
  benefits?: string[]
  snippet?: string
  summary?: string
}

const RUN_TIMEOUT_MS = Number(process.env.JOB_SEARCH_RUN_TIMEOUT_MS || 120_000)
const QUERY_CACHE_TTL_MS = Number(process.env.JOB_QUERY_CACHE_TTL_MS || 10 * 60_000)
const EXTRACT_CACHE_TTL_MS = Number(process.env.JOB_EXTRACT_CACHE_TTL_MS || 24 * 60 * 60_000)
const ENRICH_CONCURRENCY = Math.min(4, Math.max(1, Number(process.env.JOB_ENRICH_CONCURRENCY || 3)))

@Injectable()
export class JobSearchOrchestrator {
  private readonly logger = new Logger(JobSearchOrchestrator.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly valyuSearch: ValyuSearchService,
    private readonly runStore: JobSearchRunStore,
  ) {}

  async startRun(input: StartSearchRunInput): Promise<{ runId: string }> {
    const normalized = this.normalizeInput(input)
    const queryHash = this.hashKey(
      JSON.stringify({
        query: normalized.query,
        countryCode: normalized.countryCode || '',
        maxNumResults: normalized.maxNumResults,
        sourceScope: normalized.sourceScope,
        remote: normalized.remote ? '1' : '0',
        visa: normalized.visaSponsorship ? '1' : '0',
      }),
    )

    const created = await this.runStore.createRun({
      query: normalized.query,
      queryHash,
      countryCode: normalized.countryCode,
      sourceScope: normalized.sourceScope,
    })

    void this.executeRun(created.runId, normalized, queryHash).catch(async (error: any) => {
      const details = error instanceof Error ? error.message : String(error)
      await this.runStore.appendEvent(created.runId, 'run_error', { message: details })
      await this.runStore.setStatus(created.runId, 'failed')
      this.logger.error(`Search run failed (${created.runId}): ${details}`)
    })

    return created
  }

  async stopRun(runId: string): Promise<boolean> {
    const ok = this.runStore.requestStop(runId)
    if (!ok) return false
    await this.runStore.appendEvent(runId, 'run_stopped', { reason: 'User requested stop' })
    await this.runStore.setStatus(runId, 'stopped')
    return true
  }

  async getSnapshot(runId: string): Promise<Record<string, any> | null> {
    return await this.runStore.getSnapshot(runId)
  }

  async getEventsSince(runId: string, sequence = 0) {
    return await this.runStore.getEventsSince(runId, sequence)
  }

  private normalizeInput(input: StartSearchRunInput): StartSearchRunInput {
    return {
      query: String(input.query || '').trim(),
      countryCode: input.countryCode ? String(input.countryCode).trim().toUpperCase() : undefined,
      maxNumResults: Math.max(1, Math.min(10, Number(input.maxNumResults || 10))),
      sourceScope: input.sourceScope || 'global',
      remote: Boolean(input.remote),
      visaSponsorship: Boolean(input.visaSponsorship),
    }
  }

  private async executeRun(runId: string, input: StartSearchRunInput, queryHash: string): Promise<void> {
    await this.runStore.appendEvent(runId, 'run_started', {
      query: input.query,
      countryCode: input.countryCode || null,
      sourceScope: input.sourceScope,
      maxNumResults: input.maxNumResults,
      concurrency: ENRICH_CONCURRENCY,
    })

    const cache = await this.readQueryCache(queryHash)
    if (cache) {
      for (const item of cache) {
        await this.runStore.upsertResult(runId, item)
        await this.runStore.appendEvent(runId, 'candidate_ready', {
          result: item,
          cacheHit: true,
        })
      }
      await this.runStore.appendEvent(runId, 'run_progress', {
        cacheHit: true,
        message: `Returned ${cache.length} cached result(s).`,
      })
      await this.runStore.appendEvent(runId, 'run_completed', {
        total: cache.length,
        fromCache: true,
      })
      await this.runStore.setStatus(runId, 'completed')
      return
    }

    const runStartedAt = Date.now()
    const allowedDomains = getActiveDiscoveryDomains(input.sourceScope)
    await this.runStore.appendEvent(runId, 'source_scan_started', {
      sourceScope: input.sourceScope,
      allowedDomains,
    })

    const discovered = await this.valyuSearch.discoverJobCandidates({
      query: input.query,
      countryCode: input.countryCode,
      maxNumResults: Math.min(20, input.maxNumResults * 2),
      includedSources: allowedDomains,
    })

    const uniqueCandidates = discovered.slice(0, input.maxNumResults)
    if (!uniqueCandidates.length) {
      await this.runStore.appendEvent(runId, 'run_completed', { total: 0, message: 'No opportunities found.' })
      await this.runStore.setStatus(runId, 'completed')
      await this.writeQueryCache(queryHash, input, [])
      return
    }

    for (let index = 0; index < uniqueCandidates.length; index += 1) {
      const candidate = uniqueCandidates[index]
      const queuedItem = this.buildQueuedItem(candidate, input, index + 1)
      await this.runStore.upsertResult(runId, queuedItem)
      await this.runStore.appendEvent(runId, 'candidate_queued', { result: queuedItem })
    }

    const readyItems: SearchRunResultItem[] = []
    let failedCount = 0
    let didTimeOut = false

    const queue = [...uniqueCandidates]
    const workers = Array.from({ length: ENRICH_CONCURRENCY }).map(async () => {
      while (queue.length) {
        if (this.runStore.isStopRequested(runId) || didTimeOut) return
        if (Date.now() - runStartedAt >= RUN_TIMEOUT_MS) {
          if (!didTimeOut) {
            didTimeOut = true
            await this.runStore.appendEvent(runId, 'run_error', {
              code: 'timeout',
              message: 'Run timeout exceeded.',
            })
          }
          return
        }

        const candidate = queue.shift()
        if (!candidate) return
        const queuedItem = this.buildQueuedItem(candidate, input, undefined)
        const extractingItem: SearchRunResultItem = {
          ...queuedItem,
          queueStatus: 'extracting',
        }
        await this.runStore.upsertResult(runId, extractingItem)
        await this.runStore.appendEvent(runId, 'candidate_extracting', { result: extractingItem })

        try {
          const readyItem = await this.enrichCandidate(candidate, input)
          if (this.runStore.isStopRequested(runId) || didTimeOut) return
          await this.runStore.upsertResult(runId, readyItem)
          await this.runStore.appendEvent(runId, 'candidate_ready', { result: readyItem })
          readyItems.push(readyItem)
          await this.runStore.appendEvent(runId, 'run_progress', {
            ready: readyItems.length,
            failed: failedCount,
            queued: Math.max(0, queue.length),
          })
        } catch (error: any) {
          if (this.runStore.isStopRequested(runId) || didTimeOut) return
          failedCount += 1
          const message = error instanceof Error ? error.message : String(error)
          const failedItem: SearchRunResultItem = {
            ...extractingItem,
            queueStatus: 'failed',
            snippet: extractingItem.snippet || message,
          }
          await this.runStore.upsertResult(runId, failedItem)
          await this.runStore.appendEvent(runId, 'candidate_failed', {
            result: failedItem,
            message,
          })
        }
      }
    })

    await Promise.all(workers)

    if (this.runStore.isStopRequested(runId)) {
      await this.runStore.setStatus(runId, 'stopped')
      return
    }

    if (didTimeOut) {
      await this.runStore.setStatus(runId, 'failed')
      return
    }

    const finalResults = deduplicateReadyResults(readyItems)
      .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
      .slice(0, input.maxNumResults)
      .map((item, index) => ({ ...item, queuePosition: index + 1 }))

    await this.writeQueryCache(queryHash, input, finalResults)

    await this.runStore.appendEvent(runId, 'run_completed', {
      total: finalResults.length,
      failed: failedCount,
    })
    await this.runStore.setStatus(runId, 'completed')
  }

  private buildQueuedItem(candidate: ValyuDiscoveredCandidate, input: StartSearchRunInput, queuePosition?: number): SearchRunResultItem {
    const fitScore: SearchRunResultItem['fitScore'] =
      candidate.relevance >= 0.8 ? 'High' : candidate.relevance >= 0.6 ? 'Medium' : 'Low'
    const locationLabel = input.countryCode || 'Global'
    const derived = deriveCandidateJobDetails(candidate.title)
    return {
      id: this.hashKey(candidate.url),
      title: derived.title || candidate.title,
      organization: derived.organization || candidate.sourceName,
      location: locationLabel,
      fitScore,
      tags: [candidate.sourceName, candidate.sourceVerified ? 'Verified' : 'Web'],
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
    }
  }

  private async enrichCandidate(candidate: ValyuDiscoveredCandidate, input: StartSearchRunInput): Promise<SearchRunResultItem> {
    const base = this.buildQueuedItem(candidate, input)
    const canonicalUrl = canonicalizeJobUrl(candidate.url)
    if (!canonicalUrl) {
      throw new Error('Candidate URL could not be canonicalized for TinyFish extraction.')
    }
    const urlHash = this.hashKey(canonicalUrl)

    const cached = await this.prisma.jobExtractionCache.findUnique({
      where: { canonicalUrlHash: urlHash },
    })
    if (cached && cached.expiresAt.getTime() > Date.now()) {
      const payload = (cached.payload || {}) as TinyfishExtractedRecord
      return this.buildReadyItem(base, payload)
    }

    const extracted = await this.extractViaTinyfish(canonicalUrl, input.query)
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

  private async extractViaTinyfish(url: string, query: string): Promise<TinyfishExtractedRecord> {
    const goal = [
      'Open this job posting and extract structured role data.',
      'Return strict JSON only with the schema:',
      JSON.stringify({
        title: 'string',
        company: 'string',
        location: 'string',
        salary: 'string',
        employment_type: 'string',
        work_mode: 'string',
        posted_date: 'string',
        match_reason: 'string',
        snippet: 'string',
        summary: 'string',
        requirements: ['string'],
        responsibilities: ['string'],
        benefits: ['string'],
      }),
      `Search context query: ${query}`,
      'Use empty strings or empty arrays for unavailable fields.',
    ].join('\n')

    const event = await runTinyfishWithFallback({
      url,
      goal,
      browser_profile: 'stealth',
      proxy_config: { enabled: false },
      feature_flags: { enable_agent_memory: false },
      api_integration: 'tinyfinder-job-search',
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

  private pickFirstRecord(input: any): TinyfishExtractedRecord | null {
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

    const hasSignals = ['title', 'company', 'location', 'requirements', 'responsibilities', 'benefits', 'summary', 'snippet'].some((key) => key in input)
    if (hasSignals) return input as TinyfishExtractedRecord

    for (const value of Object.values(input)) {
      const parsed = this.pickFirstRecord(value)
      if (parsed) return parsed
    }
    return null
  }

  private toResultFields(payload: TinyfishExtractedRecord): Partial<SearchRunResultItem> {
    const out: Partial<SearchRunResultItem> = {}
    const title = this.safeText(payload.title)
    const organization = this.safeText(payload.company)
    const location = this.safeText(payload.location)
    const salary = this.safeText(payload.salary)
    const employmentType = this.safeText(payload.employment_type)
    const workMode = this.safeText(payload.work_mode)
    const postedDate = this.safeText(payload.posted_date)
    const matchReason = this.safeText(payload.match_reason)
    const snippet = this.safeText(payload.summary || payload.snippet)
    const requirements = this.safeList(payload.requirements)
    const responsibilities = this.safeList(payload.responsibilities)
    const benefits = this.safeList(payload.benefits)

    if (title) out.title = title
    if (organization) out.organization = organization
    if (location) out.location = location
    if (salary) out.salary = salary
    if (employmentType) out.employmentType = employmentType
    if (workMode) out.workMode = workMode
    if (postedDate) out.postedDate = postedDate
    if (matchReason) out.matchReason = matchReason
    if (snippet) out.snippet = snippet
    if (requirements.length) out.requirements = requirements
    if (responsibilities.length) out.responsibilities = responsibilities
    if (benefits.length) out.benefits = benefits
    return out
  }

  private buildReadyItem(base: SearchRunResultItem, payload: TinyfishExtractedRecord): SearchRunResultItem {
    const detailFields = this.toResultFields(payload)
    const derived = deriveCandidateJobDetails(base.title)
    const title = this.safeText(detailFields.title) || this.safeText(derived.title)
    const organization = this.safeText(detailFields.organization) || this.safeText(derived.organization) || base.organization
    if (!extractedTitleLooksValid(title)) {
      throw new Error('TinyFish did not extract a valid job title.')
    }

    return {
      ...base,
      title,
      organization,
      location: this.safeText(detailFields.location) || base.location,
      snippet: this.safeText(detailFields.snippet) || base.snippet,
      salary: this.safeText(detailFields.salary) || undefined,
      employmentType: this.safeText(detailFields.employmentType) || undefined,
      workMode: this.safeText(detailFields.workMode) || undefined,
      postedDate: this.safeText(detailFields.postedDate) || undefined,
      matchReason: this.safeText(detailFields.matchReason) || undefined,
      requirements: detailFields.requirements?.length ? detailFields.requirements : undefined,
      responsibilities: detailFields.responsibilities?.length ? detailFields.responsibilities : undefined,
      benefits: detailFields.benefits?.length ? detailFields.benefits : undefined,
      queueStatus: 'ready',
    }
  }

  private safeText(value: unknown): string {
    if (typeof value === 'string') return value.trim()
    return ''
  }

  private safeList(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .slice(0, 10)
  }

  private async readQueryCache(queryHash: string): Promise<SearchRunResultItem[] | null> {
    const cached = await this.prisma.jobQueryCache.findUnique({
      where: { queryHash },
    })
    if (!cached) return null
    if (cached.expiresAt.getTime() <= Date.now()) return null
    if (!Array.isArray(cached.payload)) return null
    return cached.payload as unknown as SearchRunResultItem[]
  }

  private async writeQueryCache(queryHash: string, input: StartSearchRunInput, results: SearchRunResultItem[]): Promise<void> {
    await this.prisma.jobQueryCache.upsert({
      where: { queryHash },
      update: {
        query: input.query,
        countryCode: input.countryCode,
        sourceScope: input.sourceScope,
        payload: results as any,
        expiresAt: new Date(Date.now() + QUERY_CACHE_TTL_MS),
      },
      create: {
        queryHash,
        query: input.query,
        countryCode: input.countryCode,
        sourceScope: input.sourceScope,
        payload: results as any,
        expiresAt: new Date(Date.now() + QUERY_CACHE_TTL_MS),
      },
    })
  }

  private hashKey(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }
}
