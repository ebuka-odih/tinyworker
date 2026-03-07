import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import {
  extractTinyfishRunPayload,
  runTinyfishBatch,
  runTinyfishWithFallback,
  waitForTinyfishRunCompletion,
} from '../tinyfish/tinyfish.client'
import { JobSearchRunStore, SearchRunResultItem } from './job-search-run.store'
import { canonicalizeScholarshipUrl, scholarshipCandidateFamilyKey } from './job-search-candidate.utils'
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
const SCHOLARSHIP_DISCOVERY_MAX_CANDIDATES = Math.max(
  4,
  Number(process.env.SCHOLARSHIP_DISCOVERY_MAX_CANDIDATES || 12),
)
const SCHOLARSHIP_TINYFISH_MAX_RUNS_PER_SEARCH = Math.max(
  1,
  Number(process.env.SCHOLARSHIP_TINYFISH_MAX_RUNS_PER_SEARCH || 4),
)
const SCHOLARSHIP_TINYFISH_MAX_RUNS_PER_DOMAIN = Math.max(
  1,
  Number(process.env.SCHOLARSHIP_TINYFISH_MAX_RUNS_PER_DOMAIN || 2),
)
const SCHOLARSHIP_TINYFISH_MAX_RUNS_PER_FAMILY = 1
const SCHOLARSHIP_SOURCE_SCOUT_ENABLED = /^true$/i.test(String(process.env.SCHOLARSHIP_SOURCE_SCOUT_ENABLED || 'false'))

type ScholarshipExtractionBudget = {
  maxRunsPerSearch: number
  maxRunsPerDomain: number
  maxRunsPerFamily: number
  sourceScoutEnabled: boolean
}

type ScholarshipRunMetrics = {
  discovered: number
  filteredOut: number
  selectedForExtraction: number
  extractedReady: number
  extractedFailed: number
  extractionBudget: ScholarshipExtractionBudget
}

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
      runKind: 'scholarship',
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
    const extractionBudget = this.resolveExtractionBudget(input.maxNumResults)

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
      extractionBudget,
    })

    const discovered = await this.valyuSearch.discoverScholarshipCandidates({
      query: input.query,
      maxNumResults: Math.max(extractionBudget.maxRunsPerSearch, SCHOLARSHIP_DISCOVERY_MAX_CANDIDATES),
      includedSources: allowedDomains,
    })

    const shortlistedCandidates = this.shortlistCandidates(discovered, extractionBudget)
    const metrics = this.createMetrics(discovered.length, discovered.length - shortlistedCandidates.length, 0, extractionBudget)

    if (!shortlistedCandidates.length) {
      await this.runStore.appendEvent(runId, 'run_progress', {
        stage: 'discovery',
        ready: 0,
        failed: 0,
        queued: 0,
        metrics,
      })
      await this.runStore.appendEvent(runId, 'run_completed', {
        total: 0,
        failed: 0,
        type: 'scholarship',
        metrics,
      })
      await this.runStore.setStatus(runId, 'completed')
      return
    }

    const readyItems: SearchRunResultItem[] = []
    let failedCount = 0
    const uncachedCandidates: ValyuDiscoveredScholarshipCandidate[] = []

    for (const candidate of shortlistedCandidates) {
      if (this.runStore.isStopRequested(runId)) {
        await this.runStore.setStatus(runId, 'stopped')
        return
      }

      const cachedItem = await this.getCachedCandidate(candidate)
      if (cachedItem) {
        const stored = await this.runStore.upsertResult(runId, cachedItem)
        if (!stored) continue
        readyItems.push(stored)
        await this.runStore.appendEvent(runId, 'candidate_ready', {
          result: stored,
          cacheHit: true,
        })
        continue
      }

      uncachedCandidates.push(candidate)
    }

    metrics.selectedForExtraction = uncachedCandidates.length

    await this.runStore.appendEvent(runId, 'run_progress', {
      stage: 'discovery',
      ready: readyItems.length,
      failed: failedCount,
      queued: uncachedCandidates.length,
      metrics,
    })

    for (let index = 0; index < uncachedCandidates.length; index += 1) {
      const candidate = uncachedCandidates[index]
      const queuedItem = this.buildQueuedItem(candidate, readyItems.length + index + 1)
      const stored = await this.runStore.upsertResult(runId, queuedItem)
      if (stored?.queueStatus === 'queued') {
        await this.runStore.appendEvent(runId, 'candidate_queued', { result: stored })
      }
    }

    if (uncachedCandidates.length) {
      await this.extractCandidates(runId, uncachedCandidates, readyItems, metrics, (nextFailedCount) => {
        failedCount = nextFailedCount
      })
    }

    if (this.runStore.isStopRequested(runId)) {
      await this.runStore.setStatus(runId, 'stopped')
      return
    }

    await this.runStore.appendEvent(runId, 'run_completed', {
      total: readyItems.length,
      failed: failedCount,
      type: 'scholarship',
      metrics,
    })
    await this.runStore.setStatus(runId, 'completed')
  }

  private resolveExtractionBudget(maxNumResults: number): ScholarshipExtractionBudget {
    return {
      maxRunsPerSearch: Math.max(1, Math.min(SCHOLARSHIP_TINYFISH_MAX_RUNS_PER_SEARCH, Number(maxNumResults || 1))),
      maxRunsPerDomain: SCHOLARSHIP_TINYFISH_MAX_RUNS_PER_DOMAIN,
      maxRunsPerFamily: SCHOLARSHIP_TINYFISH_MAX_RUNS_PER_FAMILY,
      sourceScoutEnabled: SCHOLARSHIP_SOURCE_SCOUT_ENABLED,
    }
  }

  private createMetrics(
    discovered: number,
    filteredOut: number,
    selectedForExtraction: number,
    extractionBudget: ScholarshipExtractionBudget,
  ): ScholarshipRunMetrics {
    return {
      discovered,
      filteredOut: Math.max(0, filteredOut),
      selectedForExtraction: Math.max(0, selectedForExtraction),
      extractedReady: 0,
      extractedFailed: 0,
      extractionBudget,
    }
  }

  private shortlistCandidates(
    candidates: ValyuDiscoveredScholarshipCandidate[],
    extractionBudget: ScholarshipExtractionBudget,
  ): ValyuDiscoveredScholarshipCandidate[] {
    const selected: ValyuDiscoveredScholarshipCandidate[] = []
    const domainCounts = new Map<string, number>()
    const familyCounts = new Map<string, number>()

    for (const candidate of candidates) {
      if (selected.length >= extractionBudget.maxRunsPerSearch) break

      const domainKey = String(candidate.sourceDomain || '').trim().toLowerCase()
      const familyKey = scholarshipCandidateFamilyKey(candidate)
      const nextDomainCount = domainCounts.get(domainKey) || 0
      const nextFamilyCount = familyCounts.get(familyKey) || 0

      if (nextDomainCount >= extractionBudget.maxRunsPerDomain) continue
      if (nextFamilyCount >= extractionBudget.maxRunsPerFamily) continue

      selected.push(candidate)
      domainCounts.set(domainKey, nextDomainCount + 1)
      familyCounts.set(familyKey, nextFamilyCount + 1)
    }

    return selected
  }

  private async extractCandidates(
    runId: string,
    candidates: ValyuDiscoveredScholarshipCandidate[],
    readyItems: SearchRunResultItem[],
    metrics: ScholarshipRunMetrics,
    setFailedCount: (failedCount: number) => void,
  ): Promise<void> {
    if (!candidates.length) return

    for (const candidate of candidates) {
      const queuedItem = this.buildQueuedItem(candidate)
      const extractingItem: SearchRunResultItem = {
        ...queuedItem,
        queueStatus: 'extracting',
      }
      const stored = await this.runStore.upsertResult(runId, extractingItem)
      if (stored?.queueStatus === 'extracting') {
        await this.runStore.appendEvent(runId, 'candidate_extracting', { result: stored })
      }
    }

    const batchRunIds = await this.startBatchExtraction(candidates)
    if (batchRunIds) {
      await this.pollBatchExtractionRuns(runId, batchRunIds, candidates, readyItems, metrics, setFailedCount)
      return
    }

    await this.runFallbackExtraction(runId, candidates, readyItems, metrics, setFailedCount)
  }

  private async startBatchExtraction(candidates: ValyuDiscoveredScholarshipCandidate[]): Promise<string[] | null> {
    try {
      const response = await runTinyfishBatch(
        candidates.map((candidate) =>
          this.buildTinyfishRequest(candidate, canonicalizeScholarshipUrl(candidate.url) || candidate.url),
        ),
      )
      const runIds = Array.isArray(response?.run_ids)
        ? response.run_ids.map((value) => String(value || '').trim()).filter(Boolean)
        : []
      if (runIds.length !== candidates.length) {
        throw new Error(`TinyFish batch returned ${runIds.length} run ids for ${candidates.length} candidates.`)
      }
      return runIds
    } catch (error: any) {
      const details = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Scholarship TinyFish batch start failed. Falling back to bounded async runs. ${details}`)
      return null
    }
  }

  private async pollBatchExtractionRuns(
    runId: string,
    batchRunIds: string[],
    candidates: ValyuDiscoveredScholarshipCandidate[],
    readyItems: SearchRunResultItem[],
    metrics: ScholarshipRunMetrics,
    setFailedCount: (failedCount: number) => void,
  ): Promise<void> {
    const pending = batchRunIds.map((tinyfishRunId, index) => ({
      tinyfishRunId,
      candidate: candidates[index],
    }))

    let failedCount = metrics.extractedFailed
    const queue = [...pending]
    const workers = Array.from({ length: Math.min(ENRICH_CONCURRENCY, pending.length) }).map(async () => {
      while (queue.length) {
        if (this.runStore.isStopRequested(runId)) return
        const next = queue.shift()
        if (!next?.candidate) return
        let extractedPayload: TinyfishScholarshipRecord | null = null

        try {
          extractedPayload = await this.waitForBatchExtraction(next.tinyfishRunId)
          if (this.runStore.isStopRequested(runId)) return
          const readyItem = await this.persistExtractedCandidate(next.candidate, extractedPayload)
          const stored = await this.runStore.upsertResult(runId, readyItem)
          if (!stored) continue
          readyItems.push(stored)
          metrics.extractedReady += 1
          await this.runStore.appendEvent(runId, 'candidate_ready', { result: stored })
        } catch (error: any) {
          if (this.runStore.isStopRequested(runId)) return
          failedCount += 1
          metrics.extractedFailed += 1
          const message = error instanceof Error ? error.message : String(error)
          const failedItem = this.buildFailedItem(next.candidate, message, extractedPayload)
          const stored = await this.runStore.upsertResult(runId, failedItem)
          if (stored?.queueStatus === 'failed') {
            await this.runStore.appendEvent(runId, 'candidate_failed', {
              result: stored,
              message,
            })
          }
        }

        await this.appendScholarshipProgress(runId, readyItems.length, failedCount, pending.length, metrics)
        setFailedCount(failedCount)
      }
    })

    await Promise.all(workers)
  }

  private async runFallbackExtraction(
    runId: string,
    candidates: ValyuDiscoveredScholarshipCandidate[],
    readyItems: SearchRunResultItem[],
    metrics: ScholarshipRunMetrics,
    setFailedCount: (failedCount: number) => void,
  ): Promise<void> {
    let failedCount = metrics.extractedFailed
    const queue = [...candidates]
    const workers = Array.from({ length: Math.min(ENRICH_CONCURRENCY, queue.length) }).map(async () => {
      while (queue.length) {
        if (this.runStore.isStopRequested(runId)) return
        const candidate = queue.shift()
        if (!candidate) return

        try {
          const readyItem = await this.enrichCandidate(candidate)
          if (this.runStore.isStopRequested(runId)) return
          const stored = await this.runStore.upsertResult(runId, readyItem)
          if (!stored) continue
          readyItems.push(stored)
          metrics.extractedReady += 1
          await this.runStore.appendEvent(runId, 'candidate_ready', { result: stored })
        } catch (error: any) {
          if (this.runStore.isStopRequested(runId)) return
          failedCount += 1
          metrics.extractedFailed += 1
          const message = error instanceof Error ? error.message : String(error)
          const failedItem = this.buildFailedItem(candidate, message)
          const stored = await this.runStore.upsertResult(runId, failedItem)
          if (stored?.queueStatus === 'failed') {
            await this.runStore.appendEvent(runId, 'candidate_failed', {
              result: stored,
              message,
            })
          }
        }

        await this.appendScholarshipProgress(runId, readyItems.length, failedCount, candidates.length, metrics)
        setFailedCount(failedCount)
      }
    })

    await Promise.all(workers)
  }

  private async appendScholarshipProgress(
    runId: string,
    readyCount: number,
    failedCount: number,
    totalSelected: number,
    metrics: ScholarshipRunMetrics,
  ): Promise<void> {
    await this.runStore.appendEvent(runId, 'run_progress', {
      stage: 'extraction',
      ready: readyCount,
      failed: failedCount,
      queued: Math.max(0, totalSelected - (metrics.extractedReady + metrics.extractedFailed)),
      metrics,
    })
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

  private buildPartialItem(
    base: SearchRunResultItem,
    payload: TinyfishScholarshipRecord | null,
    queueStatus: SearchRunResultItem['queueStatus'],
    fallbackMessage?: string,
  ): SearchRunResultItem {
    if (!payload) {
      return {
        ...base,
        queueStatus,
        snippet: base.snippet || fallbackMessage || '',
      }
    }

    const title = this.safeText(payload.title) || base.title
    const provider = this.safeText(payload.provider) || base.organization
    const destination = this.safeText(payload.destination) || base.location
    const deadline = this.safeText(payload.deadline)
    const studyLevel = this.safeText(payload.study_level)
    const fundingType = this.safeText(payload.funding_type)
    const snippet = this.safeText(payload.summary || payload.snippet) || base.snippet || fallbackMessage || ''
    const matchReason = this.safeText(payload.match_reason)
    const requirements = this.safeList(payload.eligibility)
    const responsibilities = this.safeList(payload.application_steps)
    const benefits = this.safeList(payload.benefits)
    const tags = Array.from(new Set([...(base.tags || []), ...(studyLevel ? [studyLevel] : []), ...(fundingType ? [fundingType] : [])]))

    return {
      ...base,
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
      queueStatus,
    }
  }

  private buildFailedItem(
    candidate: ValyuDiscoveredScholarshipCandidate,
    message: string,
    payload?: TinyfishScholarshipRecord | null,
  ): SearchRunResultItem {
    const base = this.buildQueuedItem(candidate)
    return this.buildPartialItem(base, payload || null, 'failed', message)
  }

  private async getCachedCandidate(candidate: ValyuDiscoveredScholarshipCandidate): Promise<SearchRunResultItem | null> {
    const base = this.buildQueuedItem(candidate)
    const canonicalUrl = canonicalizeScholarshipUrl(candidate.url)
    if (!canonicalUrl) return null

    const cached = await this.prisma.jobExtractionCache.findUnique({
      where: { canonicalUrlHash: this.hashKey(canonicalUrl) },
    })
    if (!cached || cached.expiresAt.getTime() <= Date.now()) {
      return null
    }

    const payload = (cached.payload || {}) as TinyfishScholarshipRecord
    return this.buildReadyItem(base, payload)
  }

  private async persistExtractedCandidate(
    candidate: ValyuDiscoveredScholarshipCandidate,
    payload: TinyfishScholarshipRecord,
  ): Promise<SearchRunResultItem> {
    const base = this.buildQueuedItem(candidate)
    const canonicalUrl = canonicalizeScholarshipUrl(candidate.url)
    if (!canonicalUrl) {
      throw new Error('Candidate URL could not be canonicalized for TinyFish extraction.')
    }

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

  private async enrichCandidate(candidate: ValyuDiscoveredScholarshipCandidate): Promise<SearchRunResultItem> {
    const cached = await this.getCachedCandidate(candidate)
    if (cached) return cached

    const canonicalUrl = canonicalizeScholarshipUrl(candidate.url)
    if (!canonicalUrl) {
      throw new Error('Candidate URL could not be canonicalized for TinyFish extraction.')
    }
    const extracted = await this.extractViaTinyfish(canonicalUrl, candidate)
    return await this.persistExtractedCandidate(candidate, extracted)
  }

  private buildTinyfishGoal(candidate: ValyuDiscoveredScholarshipCandidate): string {
    return [
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
  }

  private buildTinyfishRequest(candidate: ValyuDiscoveredScholarshipCandidate, url?: string) {
    return {
      url: url || candidate.url,
      goal: this.buildTinyfishGoal(candidate),
      browser_profile: 'stealth' as const,
      proxy_config: { enabled: false },
      feature_flags: { enable_agent_memory: false },
      api_integration: 'tinyfinder-scholarship-search',
    }
  }

  private async waitForBatchExtraction(runId: string): Promise<TinyfishScholarshipRecord> {
    const run = await waitForTinyfishRunCompletion(runId)
    const status = String(run.status || '').toUpperCase()
    if (status !== 'COMPLETED') {
      const reason =
        (run as any)?.error?.message || (run as any)?.error?.details || `status=${String(run.status || 'unknown')}`
      throw new Error(`TinyFish batch run ${runId} ended with ${reason}`)
    }

    const payload = this.pickFirstRecord(extractTinyfishRunPayload(run) ?? run)
    if (!payload) {
      return {
        summary: '',
        snippet: '',
      }
    }

    return payload
  }

  private async extractViaTinyfish(
    url: string,
    candidate: ValyuDiscoveredScholarshipCandidate,
  ): Promise<TinyfishScholarshipRecord> {
    const event = await runTinyfishWithFallback(this.buildTinyfishRequest(candidate, url))

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
    const partial = this.buildPartialItem(base, payload, 'ready')

    if (
      !this.isValidScholarshipExtraction({
        title: partial.title,
        provider: partial.organization,
        destination: partial.location,
        deadline: partial.deadline || '',
        studyLevel: partial.studyLevel || '',
        fundingType: partial.fundingType || '',
        snippet: partial.snippet || '',
        requirements: partial.requirements || [],
        responsibilities: partial.responsibilities || [],
        benefits: partial.benefits || [],
      })
    ) {
      throw new Error('TinyFish did not extract enough scholarship detail from this page.')
    }

    return {
      ...partial,
      opportunityType: 'scholarship',
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
    const scholarshipLikeTitle = /\b(scholarship|scholarships|fellowship|fellowships|grant|grants|bursary|bursaries|funding)\b/i.test(
      input.title,
    )
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

  private hashKey(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }
}
