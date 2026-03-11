import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { SearchQuotaService } from '../billing/search-quota.service'
import { runTinyfishWithFallback } from '../tinyfish/tinyfish.client'
import { canonicalizeVisaUrl, visaCandidateFamilyKey } from './job-search-candidate.utils'
import { JobSearchRunStore, SearchRunResultItem } from './job-search-run.store'
import { getActiveVisaDiscoveryDomains, VisaSourceScope } from './visa-source-registry'
import { ValyuDiscoveredVisaCandidate, ValyuSearchService } from './valyu-search.service'

type StartVisaSearchRunInput = {
  userId: string
  query: string
  maxNumResults: number
  sourceScope: VisaSourceScope
}

type TinyfishVisaRecord = {
  route_name?: string
  country?: string
  who_can_apply?: string
  eligibility_criteria?: string[]
  required_documents?: string[]
  application_steps?: string[]
  processing_time?: string
  official_link?: string
  status?: string
}

const EXTRACT_CACHE_TTL_MS = Number(process.env.JOB_EXTRACT_CACHE_TTL_MS || 24 * 60 * 60_000)

@Injectable()
export class VisaSearchOrchestrator {
  private readonly logger = new Logger(VisaSearchOrchestrator.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly valyuSearch: ValyuSearchService,
    private readonly runStore: JobSearchRunStore,
    private readonly searchQuota: SearchQuotaService,
  ) {}

  async startRun(input: StartVisaSearchRunInput): Promise<{ runId: string }> {
    const normalized = this.normalizeInput(input)
    const intentHash = this.hashKey(`visa::${normalized.query}::${normalized.sourceScope}`)
    const activeRun = this.runStore.findActiveRunByIntentHash(intentHash, normalized.userId)
    if (activeRun) return activeRun

    const quota = await this.searchQuota.consumeRunAllowance(normalized.userId, 'visa')
    let created: { runId: string }
    try {
      created = await this.runStore.createRun({
        userId: normalized.userId,
        runKind: 'visa',
        query: normalized.query,
        queryHash: intentHash,
        intentHash,
        sourceScope: normalized.sourceScope,
      })
    } catch (error) {
      if (quota.consumed) {
        await this.searchQuota.releaseConsumedRunAllowance(normalized.userId, 'visa', quota.usageDate)
      }
      throw error
    }

    void this.executeRun(created.runId, normalized).catch(async (error: unknown) => {
      const details = error instanceof Error ? error.message : String(error)
      await this.runStore.appendEvent(created.runId, 'run_error', { message: details })
      await this.runStore.setStatus(created.runId, 'failed')
      this.logger.error(`Visa search run failed (${created.runId}): ${details}`)
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

  private normalizeInput(input: StartVisaSearchRunInput): StartVisaSearchRunInput {
    return {
      userId: String(input.userId || '').trim(),
      query: String(input.query || '').trim(),
      maxNumResults: Math.max(1, Math.min(5, Number(input.maxNumResults || 5))),
      sourceScope: input.sourceScope || 'global',
    }
  }

  private async executeRun(runId: string, input: StartVisaSearchRunInput) {
    const allowedDomains = getActiveVisaDiscoveryDomains(input.sourceScope)

    await this.runStore.appendEvent(runId, 'run_started', {
      query: input.query,
      sourceScope: input.sourceScope,
      maxNumResults: input.maxNumResults,
      type: 'visa',
    })
    await this.runStore.appendEvent(runId, 'source_scan_started', {
      sourceScope: input.sourceScope,
      allowedDomains,
      type: 'visa',
    })

    const discovered = await this.valyuSearch.discoverVisaCandidates({
      query: input.query,
      maxNumResults: Math.max(input.maxNumResults * 2, input.maxNumResults),
      includedSources: allowedDomains,
    })
    const shortlisted = this.shortlistCandidates(discovered, input.maxNumResults)

    await this.runStore.appendEvent(runId, 'run_progress', {
      stage: 'discovery',
      ready: 0,
      failed: 0,
      queued: shortlisted.length,
      metrics: {
        discovered: discovered.length,
        filteredOut: Math.max(0, discovered.length - shortlisted.length),
        selectedForExtraction: shortlisted.length,
      },
    })

    const readyItems: SearchRunResultItem[] = []
    let failed = 0

    for (let index = 0; index < shortlisted.length; index += 1) {
      const candidate = shortlisted[index]
      const queued = this.buildQueuedItem(candidate, index + 1)
      await this.runStore.upsertResult(runId, queued)
      await this.runStore.appendEvent(runId, 'candidate_queued', { result: queued })
    }

    for (const candidate of shortlisted) {
      if (this.runStore.isStopRequested(runId)) {
        await this.runStore.setStatus(runId, 'stopped')
        return
      }

      const extracting = this.buildQueuedItem(candidate)
      await this.runStore.upsertResult(runId, { ...extracting, queueStatus: 'extracting' })
      await this.runStore.appendEvent(runId, 'candidate_extracting', { result: { ...extracting, queueStatus: 'extracting' } })

      try {
        const next = await this.enrichCandidate(candidate)
        const stored = await this.runStore.upsertResult(runId, next)
        if (stored) readyItems.push(stored)
        await this.runStore.appendEvent(runId, 'candidate_ready', { result: stored || next })
      } catch (error: unknown) {
        failed += 1
        const message = error instanceof Error ? error.message : 'Visa extraction failed'
        const failedItem = this.buildFailedItem(candidate, message)
        await this.runStore.upsertResult(runId, failedItem)
        await this.runStore.appendEvent(runId, 'candidate_failed', { result: failedItem, message })
      }

      await this.runStore.appendEvent(runId, 'run_progress', {
        stage: 'extraction',
        ready: readyItems.length,
        failed,
        queued: Math.max(0, shortlisted.length - readyItems.length - failed),
        metrics: {
          discovered: discovered.length,
          filteredOut: Math.max(0, discovered.length - shortlisted.length),
          selectedForExtraction: shortlisted.length,
          extractedReady: readyItems.length,
          extractedFailed: failed,
        },
      })
    }

    await this.runStore.appendEvent(runId, 'run_completed', {
      total: readyItems.length,
      failed,
      type: 'visa',
      metrics: {
        discovered: discovered.length,
        filteredOut: Math.max(0, discovered.length - shortlisted.length),
        selectedForExtraction: shortlisted.length,
        extractedReady: readyItems.length,
        extractedFailed: failed,
      },
    })
    await this.runStore.setStatus(runId, 'completed')
  }

  private shortlistCandidates(candidates: ValyuDiscoveredVisaCandidate[], maxNumResults: number) {
    const selected: ValyuDiscoveredVisaCandidate[] = []
    const seenFamilies = new Set<string>()

    for (const candidate of candidates) {
      const family = visaCandidateFamilyKey(candidate)
      if (seenFamilies.has(family)) continue
      seenFamilies.add(family)
      selected.push(candidate)
      if (selected.length >= maxNumResults) break
    }

    return selected
  }

  private buildQueuedItem(candidate: ValyuDiscoveredVisaCandidate, queuePosition?: number): SearchRunResultItem {
    return {
      id: candidate.id,
      opportunityType: 'visa',
      title: candidate.title,
      organization: candidate.sourceName,
      location: 'Official source',
      fitScore: candidate.relevance >= 0.8 ? 'High' : candidate.relevance >= 0.6 ? 'Medium' : 'Low',
      tags: [candidate.sourceName, 'Visa'],
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
    }
  }

  private buildFailedItem(candidate: ValyuDiscoveredVisaCandidate, message: string): SearchRunResultItem {
    return {
      ...this.buildQueuedItem(candidate),
      queueStatus: 'failed',
      snippet: message,
    }
  }

  private async enrichCandidate(candidate: ValyuDiscoveredVisaCandidate): Promise<SearchRunResultItem> {
    const cached = await this.getCachedCandidate(candidate)
    if (cached) return cached

    const canonicalUrl = canonicalizeVisaUrl(candidate.url)
    if (!canonicalUrl) {
      throw new Error('Candidate URL could not be canonicalized for TinyFish extraction.')
    }

    const payload = await this.extractViaTinyfish(canonicalUrl, candidate)
    return await this.persistExtractedCandidate(candidate, payload)
  }

  private async getCachedCandidate(candidate: ValyuDiscoveredVisaCandidate): Promise<SearchRunResultItem | null> {
    const canonicalUrl = canonicalizeVisaUrl(candidate.url)
    if (!canonicalUrl) return null

    const cached = await this.prisma.jobExtractionCache.findUnique({
      where: { canonicalUrlHash: this.hashKey(canonicalUrl) },
    })
    if (!cached || cached.expiresAt.getTime() <= Date.now()) return null

    return this.buildReadyItem(this.buildQueuedItem(candidate), (cached.payload || {}) as TinyfishVisaRecord)
  }

  private async persistExtractedCandidate(candidate: ValyuDiscoveredVisaCandidate, payload: TinyfishVisaRecord) {
    const canonicalUrl = canonicalizeVisaUrl(candidate.url)
    if (!canonicalUrl) {
      throw new Error('Candidate URL could not be canonicalized for TinyFish extraction.')
    }

    const base = this.buildQueuedItem(candidate)
    await this.prisma.jobExtractionCache.upsert({
      where: { canonicalUrlHash: this.hashKey(canonicalUrl) },
      update: {
        canonicalUrl,
        sourceName: base.sourceName,
        sourceDomain: base.sourceDomain,
        payload: payload as any,
        expiresAt: new Date(Date.now() + EXTRACT_CACHE_TTL_MS),
      },
      create: {
        canonicalUrlHash: this.hashKey(canonicalUrl),
        canonicalUrl,
        sourceName: base.sourceName,
        sourceDomain: base.sourceDomain,
        payload: payload as any,
        expiresAt: new Date(Date.now() + EXTRACT_CACHE_TTL_MS),
      },
    })

    return this.buildReadyItem(base, payload)
  }

  private async extractViaTinyfish(url: string, candidate: ValyuDiscoveredVisaCandidate): Promise<TinyfishVisaRecord> {
    const event = await runTinyfishWithFallback({
      url,
      goal: [
        'Open this official visa page and extract structured visa route data.',
        'Return strict JSON only with the schema:',
        JSON.stringify({
          route_name: 'string',
          country: 'string',
          who_can_apply: 'string',
          eligibility_criteria: ['string'],
          required_documents: ['string'],
          application_steps: ['string'],
          processing_time: 'string',
          official_link: 'string',
          status: 'string',
        }),
        `Search context query: ${candidate.title}`,
        'Use empty strings or empty arrays for unavailable fields.',
      ].join('\n'),
      browser_profile: 'stealth' as const,
      proxy_config: { enabled: false },
      feature_flags: { enable_agent_memory: false },
      api_integration: 'tinyfinder-visa-search',
    })

    return this.pickFirstRecord(event?.resultJson ?? event?.result ?? event?.data?.resultJson ?? event?.data?.result ?? event)
  }

  private pickFirstRecord(input: any): TinyfishVisaRecord {
    if (!input) return {}
    if (typeof input === 'string') {
      try {
        return this.pickFirstRecord(JSON.parse(input))
      } catch {
        return {}
      }
    }
    if (Array.isArray(input)) {
      for (const item of input) {
        const parsed = this.pickFirstRecord(item)
        if (Object.keys(parsed).length) return parsed
      }
      return {}
    }
    if (typeof input !== 'object') return {}
    const hasSignals = ['route_name', 'country', 'official_link'].some((key) => key in input)
    if (hasSignals) return input as TinyfishVisaRecord
    for (const value of Object.values(input)) {
      const parsed = this.pickFirstRecord(value)
      if (Object.keys(parsed).length) return parsed
    }
    return {}
  }

  private buildReadyItem(base: SearchRunResultItem, payload: TinyfishVisaRecord): SearchRunResultItem {
    const title = this.safeText(payload.route_name) || base.title
    const country = this.safeText(payload.country) || base.location
    const whoCanApply = this.safeText(payload.who_can_apply)
    const officialLink = this.safeText(payload.official_link)
    const processingTime = this.safeText(payload.processing_time)
    const status = this.safeText(payload.status)
    const requirements = this.safeList(payload.eligibility_criteria)
    const responsibilities = this.safeList(payload.required_documents)
    const benefits = this.safeList(payload.application_steps)
    const snippet = [whoCanApply, requirements[0]].filter(Boolean).join(' • ') || base.snippet || ''

    if (!this.isValidVisaExtraction({ title, officialLink, status })) {
      throw new Error('TinyFish did not extract enough visa detail from this page.')
    }

    return {
      ...base,
      title,
      location: country || base.location,
      whoCanApply: whoCanApply || undefined,
      officialApplicationLink: officialLink || undefined,
      processingTime: processingTime || undefined,
      link: officialLink || base.link,
      snippet,
      requirements: requirements.length ? requirements : undefined,
      responsibilities: responsibilities.length ? responsibilities : undefined,
      benefits: benefits.length ? benefits : undefined,
      queueStatus: 'ready',
      metadata: {
        status: status || undefined,
      },
    }
  }

  private isValidVisaExtraction(input: { title: string; officialLink: string; status: string }) {
    const hasOfficialLink = /^https?:\/\//i.test(input.officialLink)
    const hasStatus = !input.status || !/\b(closed|expired|ended)\b/i.test(input.status)
    return Boolean(input.title.trim()) && hasOfficialLink && hasStatus
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

  private hashKey(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }
}
