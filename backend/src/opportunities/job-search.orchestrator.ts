import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { runTinyfishWithFallback } from '../tinyfish/tinyfish.client'
import {
  canonicalizeJobUrl,
  deduplicateReadyResults,
  deriveCandidateJobDetails,
  extractedTitleLooksValid,
  isRecentJobPostingValue,
  rankSearchRunResults,
} from './job-search-candidate.utils'
import {
  buildJobSearchCacheIdentity,
  type JobSearchCacheIdentity,
  sliceCachedReadyResults,
} from './job-search-cache.utils'
import { getActiveDiscoveryDomains, isHeavyJobSiteDomain, JobSourceScope } from './job-source-registry'
import {
  JobSearchRunStore,
  SearchRunCacheState,
  SearchRunResultItem,
} from './job-search-run.store'
import { ValyuDiscoveredCandidate, ValyuSearchService } from './valyu-search.service'

type StartSearchRunInput = {
  userId: string
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

type QueryCacheHit = {
  cache: SearchRunCacheState
  results: SearchRunResultItem[]
}

const RUN_TIMEOUT_MS = Number(process.env.JOB_SEARCH_RUN_TIMEOUT_MS || 0)
const SUCCESS_QUERY_CACHE_TTL_MS = Number(process.env.JOB_QUERY_CACHE_TTL_MS || 6 * 60 * 60_000)
const EMPTY_QUERY_CACHE_TTL_MS = Number(process.env.JOB_EMPTY_QUERY_CACHE_TTL_MS || 10 * 60_000)
const EXTRACT_CACHE_TTL_MS = Number(process.env.JOB_EXTRACT_CACHE_TTL_MS || 24 * 60 * 60_000)
const ENRICH_CONCURRENCY = Math.min(4, Math.max(1, Number(process.env.JOB_ENRICH_CONCURRENCY || 3)))
const MAX_JOB_AGE_DAYS = Math.max(1, Number(process.env.JOB_SEARCH_MAX_AGE_DAYS || 21))
const HEAVY_SITE_PROXY_ENABLED = String(process.env.JOB_SEARCH_HEAVY_SITE_PROXY_ENABLED || 'true').toLowerCase() !== 'false'
const HEAVY_SITE_PROXY_COUNTRY = String(process.env.JOB_SEARCH_HEAVY_SITE_PROXY_COUNTRY || '').trim().toUpperCase()

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
    const cacheIdentity = buildJobSearchCacheIdentity(normalized)
    const activeRun = this.runStore.findActiveRunByIntentHash(cacheIdentity.intentHash, normalized.userId)
    if (activeRun) {
      return activeRun
    }

    const created = await this.runStore.createRun({
      userId: normalized.userId,
      runKind: 'job',
      query: normalized.query,
      queryHash: cacheIdentity.queryHash,
      intentHash: cacheIdentity.intentHash,
      countryCode: normalized.countryCode,
      sourceScope: normalized.sourceScope,
    })

    void this.executeRun(created.runId, normalized, cacheIdentity).catch(async (error: any) => {
      const details = error instanceof Error ? error.message : String(error)
      await this.runStore.appendEvent(created.runId, 'run_error', { message: details })
      await this.runStore.setStatus(created.runId, 'failed')
      this.logger.error(`Search run failed (${created.runId}): ${details}`)
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

  async getCachedSearchResults(
    input: StartSearchRunInput,
  ): Promise<{ results: SearchRunResultItem[]; cache: SearchRunCacheState } | null> {
    const normalized = this.normalizeInput(input)
    const identity = buildJobSearchCacheIdentity(normalized)
    const cacheHit = await this.readQueryCache(identity, normalized.maxNumResults)
    if (!cacheHit) return null
    return {
      results: cacheHit.results,
      cache: cacheHit.cache,
    }
  }

  private normalizeInput(input: StartSearchRunInput): StartSearchRunInput {
    return {
      userId: String(input.userId || '').trim(),
      query: String(input.query || '').trim(),
      countryCode: input.countryCode ? String(input.countryCode).trim().toUpperCase() : undefined,
      maxNumResults: Math.max(1, Math.min(10, Number(input.maxNumResults || 10))),
      sourceScope: input.sourceScope || 'global',
      remote: Boolean(input.remote),
      visaSponsorship: Boolean(input.visaSponsorship),
    }
  }

  private async executeRun(
    runId: string,
    input: StartSearchRunInput,
    cacheIdentity: JobSearchCacheIdentity,
  ): Promise<void> {
    await this.runStore.appendEvent(runId, 'run_started', {
      query: input.query,
      countryCode: input.countryCode || null,
      sourceScope: input.sourceScope,
      maxNumResults: input.maxNumResults,
      concurrency: ENRICH_CONCURRENCY,
    })

    const cacheHit = await this.readQueryCache(cacheIdentity, input.maxNumResults)
    const cachedResults = cacheHit?.results || []
    if (cacheHit) {
      const activeCache = { ...cacheHit.cache, refreshing: true }
      await this.runStore.setCacheState(runId, activeCache)
      await this.runStore.appendEvent(runId, 'run_cache_hit', {
        cache: activeCache,
        total: cachedResults.length,
      })
      for (const item of cachedResults) {
        const stored = await this.runStore.upsertResult(runId, item)
        if (!stored) continue
        await this.runStore.appendEvent(runId, 'candidate_ready', {
          result: stored,
          cacheHit: true,
        })
      }
      await this.runStore.appendEvent(runId, 'run_progress', {
        ready: cachedResults.length,
        failed: 0,
        queued: 0,
        cacheHit: true,
        message:
          cachedResults.length > 0
            ? `Showing ${cachedResults.length} cached result(s) while refreshing.`
            : 'Showing cached empty results while refreshing.',
      })
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
      if (!cachedResults.length) {
        await this.writeQueryCache(cacheIdentity, input, [], {
          allowIntentReuse: false,
          ttlMs: EMPTY_QUERY_CACHE_TTL_MS,
        })
      }
      await this.runStore.appendEvent(runId, 'run_completed', {
        total: cachedResults.length,
        failed: 0,
        fromCache: Boolean(cacheHit),
      })
      await this.runStore.setStatus(runId, 'completed')
      return
    }

    for (let index = 0; index < uniqueCandidates.length; index += 1) {
      const candidate = uniqueCandidates[index]
      const queuedItem = this.buildQueuedItem(candidate, input, index + 1)
      const stored = await this.runStore.upsertResult(runId, queuedItem)
      if (stored?.queueStatus === 'queued') {
        await this.runStore.appendEvent(runId, 'candidate_queued', { result: stored })
      }
    }

    const readyItems: SearchRunResultItem[] = [...cachedResults]
    let failedCount = 0
    let didTimeOut = false

    const queue = [...uniqueCandidates]
    const workers = Array.from({ length: ENRICH_CONCURRENCY }).map(async () => {
      while (queue.length) {
        if (this.runStore.isStopRequested(runId) || didTimeOut) return
        if (RUN_TIMEOUT_MS > 0 && Date.now() - runStartedAt >= RUN_TIMEOUT_MS) {
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
        const extractingStored = await this.runStore.upsertResult(runId, extractingItem)
        if (extractingStored?.queueStatus === 'extracting') {
          await this.runStore.appendEvent(runId, 'candidate_extracting', { result: extractingStored })
        }

        try {
          const readyItem = await this.enrichCandidate(candidate, input)
          if (this.runStore.isStopRequested(runId) || didTimeOut) return
          const stored = await this.runStore.upsertResult(runId, readyItem)
          if (!stored) continue
          await this.runStore.appendEvent(runId, 'candidate_ready', { result: stored })
          readyItems.push(stored)
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

    if (didTimeOut) {
      await this.runStore.setStatus(runId, 'failed')
      return
    }

    const finalResults = rankSearchRunResults(deduplicateReadyResults(readyItems))
      .slice(0, input.maxNumResults)

    if (finalResults.length > 0) {
      await this.writeQueryCache(cacheIdentity, input, finalResults, {
        allowIntentReuse: true,
        ttlMs: SUCCESS_QUERY_CACHE_TTL_MS,
      })
    } else if (!cachedResults.length) {
      await this.writeQueryCache(cacheIdentity, input, [], {
        allowIntentReuse: false,
        ttlMs: EMPTY_QUERY_CACHE_TTL_MS,
      })
    }

    await this.runStore.appendEvent(runId, 'run_completed', {
      total: finalResults.length,
      failed: failedCount,
      fromCache: Boolean(cacheHit),
    })
    await this.runStore.setStatus(runId, 'completed')
  }

  private buildQueuedItem(
    candidate: ValyuDiscoveredCandidate,
    input: StartSearchRunInput,
    queuePosition?: number,
  ): SearchRunResultItem {
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
      seenOn: [
        {
          sourceName: candidate.sourceName,
          sourceDomain: candidate.sourceDomain,
          sourceVerified: candidate.sourceVerified,
        },
      ],
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

    const extracted = await this.extractViaTinyfish(canonicalUrl, input.query, base.sourceDomain)
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

  private async extractViaTinyfish(url: string, query: string, sourceDomain: string): Promise<TinyfishExtractedRecord> {
    const useHeavySiteProxy = HEAVY_SITE_PROXY_ENABLED && isHeavyJobSiteDomain(sourceDomain)
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
      proxy_config: {
        enabled: useHeavySiteProxy,
        country_code: useHeavySiteProxy && HEAVY_SITE_PROXY_COUNTRY ? HEAVY_SITE_PROXY_COUNTRY : undefined,
      },
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
    if (!isRecentJobPostingValue(this.safeText(detailFields.postedDate), MAX_JOB_AGE_DAYS)) {
      throw new Error(`Job posting is older than ${MAX_JOB_AGE_DAYS} days.`)
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

  private async readQueryCache(
    identity: JobSearchCacheIdentity,
    maxNumResults: number,
  ): Promise<QueryCacheHit | null> {
    const now = new Date()
    const exact = await this.prisma.jobQueryCache.findUnique({
      where: { queryHash: identity.queryHash },
    })
    const exactHit = this.toQueryCacheHit(exact, 'exact', maxNumResults, now)
    if (exactHit) return exactHit

    const intent = await this.prisma.jobQueryCache.findFirst({
      where: {
        intentHash: identity.intentHash,
        resultCount: { gt: 0 },
        expiresAt: { gt: now },
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    return this.toQueryCacheHit(intent, 'intent', maxNumResults, now)
  }

  private toQueryCacheHit(
    cached: {
      payload: unknown
      expiresAt: Date
      updatedAt: Date
    } | null,
    mode: SearchRunCacheState['mode'],
    maxNumResults: number,
    now: Date,
  ): QueryCacheHit | null {
    if (!cached) return null
    if (cached.expiresAt.getTime() <= now.getTime()) return null
    if (!Array.isArray(cached.payload)) return null

    return {
      cache: {
        mode,
        cachedAt: cached.updatedAt.toISOString(),
        ageMs: Math.max(0, now.getTime() - cached.updatedAt.getTime()),
        refreshing: false,
      },
      results: sliceCachedReadyResults(cached.payload as SearchRunResultItem[], maxNumResults),
    }
  }

  private async writeQueryCache(
    identity: JobSearchCacheIdentity,
    input: StartSearchRunInput,
    results: SearchRunResultItem[],
    options: { allowIntentReuse: boolean; ttlMs: number },
  ): Promise<void> {
    await this.prisma.jobQueryCache.upsert({
      where: { queryHash: identity.queryHash },
      update: {
        query: input.query,
        intentHash: options.allowIntentReuse ? identity.intentHash : null,
        normalizedIntent: identity.normalizedIntent,
        countryCode: input.countryCode,
        sourceScope: input.sourceScope,
        remote: Boolean(input.remote),
        visaSponsorship: Boolean(input.visaSponsorship),
        resultCount: results.length,
        payload: results as any,
        expiresAt: new Date(Date.now() + options.ttlMs),
      },
      create: {
        queryHash: identity.queryHash,
        query: input.query,
        intentHash: options.allowIntentReuse ? identity.intentHash : null,
        normalizedIntent: identity.normalizedIntent,
        countryCode: input.countryCode,
        sourceScope: input.sourceScope,
        remote: Boolean(input.remote),
        visaSponsorship: Boolean(input.visaSponsorship),
        resultCount: results.length,
        payload: results as any,
        expiresAt: new Date(Date.now() + options.ttlMs),
      },
    })
  }

  private hashKey(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }
}
