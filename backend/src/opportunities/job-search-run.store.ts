import { Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { rankSearchRunResults, readyResultScore, searchRunResultIdentityKey } from './job-search-candidate.utils'

export type SearchRunStatus = 'running' | 'completed' | 'failed' | 'stopped'
export type SearchRunEventType =
  | 'run_started'
  | 'run_cache_hit'
  | 'source_scan_started'
  | 'candidate_queued'
  | 'candidate_extracting'
  | 'candidate_ready'
  | 'candidate_failed'
  | 'run_progress'
  | 'run_completed'
  | 'run_stopped'
  | 'run_error'

export type SearchRunEvent = {
  id: string
  runId: string
  sequence: number
  type: SearchRunEventType
  payload: Record<string, any> | null
  createdAt: string
}

export type SearchRunResultItem = {
  id: string
  opportunityType?: 'job' | 'scholarship' | 'visa'
  title: string
  organization: string
  location: string
  deadline?: string
  fitScore: 'High' | 'Medium' | 'Low'
  tags: string[]
  link: string
  status: 'new' | 'shortlisted' | 'saved' | 'applied' | 'needs-info'
  sourceName: string
  sourceDomain: string
  sourceType: 'job_board' | 'ats' | 'company_careers'
  sourceVerified: boolean
  queueStatus: 'queued' | 'extracting' | 'verified' | 'ready' | 'failed'
  queuePosition?: number
  snippet?: string
  relevance?: number
  salary?: string
  employmentType?: string
  workMode?: string
  postedDate?: string
  studyLevel?: string
  fundingType?: string
  matchReason?: string
  requirements?: string[]
  responsibilities?: string[]
  benefits?: string[]
  isSuspicious?: boolean
  seenOn?: Array<{
    sourceName: string
    sourceDomain: string
    sourceVerified: boolean
  }>
}

export type SearchRunCacheState = {
  mode: 'exact' | 'intent'
  cachedAt: string
  ageMs: number
  refreshing: boolean
}

type RunState = {
  id: string
  userId?: string
  query: string
  queryHash: string
  intentHash: string
  countryCode?: string
  sourceScope: string
  status: SearchRunStatus
  startedAt: string
  completedAt?: string
  stoppedAt?: string
  stopRequested: boolean
  nextSequence: number
  events: SearchRunEvent[]
  listeners: Set<(event: SearchRunEvent) => void>
  results: Map<string, SearchRunResultItem>
  cache: SearchRunCacheState | null
}

type CreateRunInput = {
  userId?: string
  query: string
  queryHash: string
  intentHash: string
  countryCode?: string
  sourceScope: string
}

const MAX_EVENT_BUFFER = 500
const MAX_COMPLETED_RUN_AGE_MS = 1000 * 60 * 30

@Injectable()
export class JobSearchRunStore {
  private readonly logger = new Logger(JobSearchRunStore.name)
  private readonly runs = new Map<string, RunState>()

  constructor(private readonly prisma: PrismaService) {
    setInterval(() => this.pruneCompletedRuns(), 60_000).unref?.()
  }

  async createRun(input: CreateRunInput): Promise<{ runId: string }> {
    const id = randomUUID()
    const startedAt = new Date().toISOString()
    const state: RunState = {
      id,
      userId: input.userId,
      query: input.query,
      queryHash: input.queryHash,
      intentHash: input.intentHash,
      countryCode: input.countryCode,
      sourceScope: input.sourceScope,
      status: 'running',
      startedAt,
      stopRequested: false,
      nextSequence: 1,
      events: [],
      listeners: new Set(),
      results: new Map(),
      cache: null,
    }
    this.runs.set(id, state)

    await this.prisma.jobSearchRun.create({
      data: {
        id,
        userId: input.userId ?? null,
        query: input.query,
        queryHash: input.queryHash,
        intentHash: input.intentHash,
        countryCode: input.countryCode,
        sourceScope: input.sourceScope,
        status: 'running',
      },
    })

    return { runId: id }
  }

  findActiveRunByIntentHash(intentHash: string, userId: string): { runId: string } | null {
    const safeIntentHash = String(intentHash || '').trim()
    if (!safeIntentHash) return null

    for (const run of this.runs.values()) {
      if (run.status !== 'running') continue
      if (!this.isRunOwner(run, userId)) continue
      if (run.intentHash !== safeIntentHash) continue
      return { runId: run.id }
    }

    return null
  }

  getRunStatus(runId: string): SearchRunStatus | null {
    return this.runs.get(runId)?.status || null
  }

  isStopRequested(runId: string): boolean {
    return Boolean(this.runs.get(runId)?.stopRequested)
  }

  requestStop(runId: string, userId: string): boolean {
    const run = this.runs.get(runId)
    if (!run) return false
    if (!this.isRunOwner(run, userId)) return false
    run.stopRequested = true
    return true
  }

  async setStatus(runId: string, status: SearchRunStatus): Promise<void> {
    const run = this.runs.get(runId)
    if (!run) return
    run.status = status
    if (run.cache) {
      run.cache = {
        ...run.cache,
        refreshing: status === 'running',
      }
    }
    const now = new Date().toISOString()
    if (status === 'completed' || status === 'failed') {
      run.completedAt = now
    }
    if (status === 'stopped') {
      run.stoppedAt = now
      run.completedAt = now
    }

    await this.prisma.jobSearchRun.update({
      where: { id: runId },
      data: {
        status,
        completedAt: run.completedAt ? new Date(run.completedAt) : null,
        stoppedAt: run.stoppedAt ? new Date(run.stoppedAt) : null,
      },
    })
  }

  async setCacheState(runId: string, cache: SearchRunCacheState | null): Promise<void> {
    const run = this.runs.get(runId)
    if (!run) return
    run.cache = cache
  }

  async upsertResult(runId: string, result: SearchRunResultItem): Promise<SearchRunResultItem | null> {
    const run = this.runs.get(runId)
    if (!run) return null
    const existingId = run.results.has(result.id) ? result.id : this.findExistingResultIdByIdentity(run, result)
    const existing = existingId ? run.results.get(existingId) : undefined
    const next = this.mergeResult(existing, result)
    run.results.set(existingId || result.id, next)
    this.reRankRunResults(run)

    const values = Array.from(run.results.values())
    const counts = this.countResults(values)

    await this.prisma.jobSearchRun.update({
      where: { id: runId },
      data: {
        totalQueued: counts.queued,
        totalReady: counts.ready,
        totalFailed: counts.failed,
      },
    })

    return run.results.get(existingId || result.id) || next
  }

  async appendEvent(runId: string, type: SearchRunEventType, payload?: Record<string, any>): Promise<SearchRunEvent | null> {
    const run = this.runs.get(runId)
    if (!run) return null

    const event: SearchRunEvent = {
      id: randomUUID(),
      runId,
      sequence: run.nextSequence,
      type,
      payload: payload || null,
      createdAt: new Date().toISOString(),
    }
    run.nextSequence += 1
    run.events.push(event)
    if (run.events.length > MAX_EVENT_BUFFER) {
      run.events.splice(0, run.events.length - MAX_EVENT_BUFFER)
    }

    for (const listener of run.listeners) {
      try {
        listener(event)
      } catch (error) {
        const details = error instanceof Error ? error.message : String(error)
        this.logger.warn(`Failed to notify run listener (${runId}): ${details}`)
      }
    }

    await this.prisma.jobSearchRunEvent.create({
      data: {
        id: event.id,
        runId,
        sequence: event.sequence,
        type: event.type,
        payload: event.payload || undefined,
      },
    })

    await this.prisma.jobSearchRun.update({
      where: { id: runId },
      data: { lastSequence: event.sequence },
    })

    return event
  }

  subscribe(runId: string, userId: string, listener: (event: SearchRunEvent) => void): (() => void) | null {
    const run = this.runs.get(runId)
    if (!run) return null
    if (!this.isRunOwner(run, userId)) return null
    run.listeners.add(listener)
    return () => run.listeners.delete(listener)
  }

  async getEventsSince(runId: string, userId: string, sequence = 0): Promise<SearchRunEvent[]> {
    const run = this.runs.get(runId)
    if (run) {
      if (!this.isRunOwner(run, userId)) return []
      return run.events.filter((event) => event.sequence > sequence)
    }

    const persistedRun = await this.prisma.jobSearchRun.findFirst({
      where: {
        id: runId,
        userId,
      },
      select: { id: true },
    })
    if (!persistedRun) return []

    const persisted = await this.prisma.jobSearchRunEvent.findMany({
      where: {
        runId,
        sequence: { gt: sequence },
      },
      orderBy: { sequence: 'asc' },
      take: MAX_EVENT_BUFFER,
    })

    return persisted.map((event) => ({
      id: event.id,
      runId: event.runId,
      sequence: event.sequence,
      type: event.type as SearchRunEventType,
      payload: (event.payload as Record<string, any> | null) || null,
      createdAt: event.createdAt.toISOString(),
    }))
  }

  async getSnapshot(runId: string, userId: string): Promise<Record<string, any> | null> {
    const run = this.runs.get(runId)
    if (run) {
      if (!this.isRunOwner(run, userId)) return null
      return this.toSnapshot(run)
    }

    const persisted = await this.prisma.jobSearchRun.findFirst({
      where: {
        id: runId,
        userId,
      },
    })
    if (!persisted) return null

    const events = await this.getEventsSince(runId, userId, 0)
    const results = this.reconstructResultsFromEvents(events)
    const counts = this.countResults(results)
    return {
      runId: persisted.id,
      query: persisted.query,
      countryCode: persisted.countryCode || undefined,
      sourceScope: persisted.sourceScope,
      status: persisted.status,
      startedAt: persisted.startedAt.toISOString(),
      completedAt: persisted.completedAt?.toISOString(),
      stoppedAt: persisted.stoppedAt?.toISOString(),
      lastSequence: persisted.lastSequence,
      counts,
      cache: this.extractCacheStateFromEvents(events, persisted.status as SearchRunStatus),
      results,
      events,
    }
  }

  private isRunOwner(run: Pick<RunState, 'userId'>, userId: string): boolean {
    return Boolean(run.userId && run.userId === userId)
  }

  private toSnapshot(run: RunState): Record<string, any> {
    this.reRankRunResults(run)
    const values = Array.from(run.results.values())
    const counts = this.countResults(values)
    return {
      runId: run.id,
      query: run.query,
      countryCode: run.countryCode,
      sourceScope: run.sourceScope,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      stoppedAt: run.stoppedAt,
      lastSequence: run.nextSequence - 1,
      counts,
      cache: run.cache,
      results: values,
      events: run.events,
    }
  }

  private reconstructResultsFromEvents(events: SearchRunEvent[]): SearchRunResultItem[] {
    const byId = new Map<string, SearchRunResultItem>()

    for (const event of events) {
      if (!['candidate_queued', 'candidate_extracting', 'candidate_ready', 'candidate_failed'].includes(event.type)) {
        continue
      }

      const incoming = event.payload?.result as SearchRunResultItem | undefined
      if (!incoming?.id) continue

      const existingId = byId.has(incoming.id) ? incoming.id : this.findExistingResultIdByIdentity(byId, incoming)
      const existing = existingId ? byId.get(existingId) : undefined
      byId.set(existingId || incoming.id, this.mergeResult(existing, incoming))
    }

    return rankSearchRunResults(Array.from(byId.values()))
  }

  private reRankRunResults(run: RunState): void {
    const ranked = rankSearchRunResults(Array.from(run.results.values()))
    run.results = new Map(ranked.map((item) => [item.id, item]))
  }

  private findExistingResultIdByIdentity(
    run: Pick<RunState, 'results'> | Map<string, SearchRunResultItem>,
    incoming: SearchRunResultItem,
  ): string | null {
    const values = run instanceof Map ? Array.from(run.entries()) : Array.from(run.results.entries())
    const incomingKey = searchRunResultIdentityKey(incoming)
    for (const [existingId, existing] of values) {
      if (searchRunResultIdentityKey(existing) === incomingKey) {
        return existingId
      }
    }
    return null
  }

  private countResults(results: SearchRunResultItem[]): { queued: number; ready: number; failed: number } {
    return results.reduce(
      (acc, item) => {
        if (item.queueStatus === 'failed') {
          acc.failed += 1
        } else if (item.queueStatus === 'queued' || item.queueStatus === 'extracting') {
          acc.queued += 1
        } else {
          acc.ready += 1
        }
        return acc
      },
      { queued: 0, ready: 0, failed: 0 },
    )
  }

  private pruneCompletedRuns(): void {
    const now = Date.now()
    for (const [runId, run] of this.runs.entries()) {
      if (run.status === 'running') continue
      const finishedAt = run.completedAt ? Date.parse(run.completedAt) : Date.parse(run.startedAt)
      if (Number.isFinite(finishedAt) && now - finishedAt > MAX_COMPLETED_RUN_AGE_MS) {
        this.runs.delete(runId)
      }
    }
  }

  private mergeResult(
    existing: SearchRunResultItem | undefined,
    incoming: SearchRunResultItem,
  ): SearchRunResultItem {
    if (!existing) return incoming

    const existingReady = this.isReadyLike(existing.queueStatus)
    const incomingReady = this.isReadyLike(incoming.queueStatus)
    if (existingReady && !incomingReady) {
      return existing
    }

    const stronger = readyResultScore(incoming) >= readyResultScore(existing) ? incoming : existing
    const weaker = stronger === incoming ? existing : incoming

    return {
      ...weaker,
      ...stronger,
      id: existing.id,
      queueStatus: incomingReady || !existingReady ? incoming.queueStatus : existing.queueStatus,
      queuePosition: incoming.queuePosition ?? existing.queuePosition,
      snippet:
        incoming.queueStatus === 'failed'
          ? incoming.snippet || existing.snippet
          : stronger.snippet || weaker.snippet,
      tags: Array.from(new Set([...(existing.tags || []), ...(incoming.tags || [])])),
      requirements: stronger.requirements?.length ? stronger.requirements : weaker.requirements,
      responsibilities: stronger.responsibilities?.length ? stronger.responsibilities : weaker.responsibilities,
      benefits: stronger.benefits?.length ? stronger.benefits : weaker.benefits,
      seenOn: this.mergeSeenOn(existing, incoming),
    }
  }

  private isReadyLike(status: SearchRunResultItem['queueStatus']): boolean {
    return status === 'ready' || status === 'verified'
  }

  private extractCacheStateFromEvents(
    events: SearchRunEvent[],
    status: SearchRunStatus,
  ): SearchRunCacheState | null {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index]
      if (event.type !== 'run_cache_hit') continue
      const cache = event.payload?.cache as SearchRunCacheState | undefined
      if (!cache) return null
      return {
        ...cache,
        refreshing: status === 'running',
      }
    }

    return null
  }

  private mergeSeenOn(existing: SearchRunResultItem, incoming: SearchRunResultItem): SearchRunResultItem['seenOn'] {
    const merged = [
      ...(existing.seenOn || []),
      ...(incoming.seenOn || []),
      {
        sourceName: existing.sourceName,
        sourceDomain: existing.sourceDomain,
        sourceVerified: existing.sourceVerified,
      },
      {
        sourceName: incoming.sourceName,
        sourceDomain: incoming.sourceDomain,
        sourceVerified: incoming.sourceVerified,
      },
    ]

    const deduped = new Map<string, NonNullable<SearchRunResultItem['seenOn']>[number]>()
    for (const source of merged) {
      const key = `${source.sourceName}::${source.sourceDomain}`
      if (!deduped.has(key)) {
        deduped.set(key, source)
      }
    }

    return Array.from(deduped.values())
  }
}
