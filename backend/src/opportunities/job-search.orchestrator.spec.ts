describe('JobSearchOrchestrator cache behavior', () => {
  const originalTimeout = process.env.JOB_SEARCH_RUN_TIMEOUT_MS

  afterEach(() => {
    if (originalTimeout === undefined) {
      delete process.env.JOB_SEARCH_RUN_TIMEOUT_MS
    } else {
      process.env.JOB_SEARCH_RUN_TIMEOUT_MS = originalTimeout
    }
    jest.resetModules()
    jest.clearAllMocks()
  })

  async function flushAsync() {
    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))
  }

  function createRunStore() {
    return {
      createRun: jest.fn().mockResolvedValue({ runId: 'run-1' }),
      findActiveRunByIntentHash: jest.fn().mockReturnValue(null),
      upsertResult: jest.fn().mockImplementation(async (_runId, result) => result),
      appendEvent: jest.fn().mockResolvedValue(null),
      setStatus: jest.fn().mockResolvedValue(undefined),
      setCacheState: jest.fn().mockResolvedValue(undefined),
      isStopRequested: jest.fn().mockReturnValue(false),
      requestStop: jest.fn().mockReturnValue(true),
      getSnapshot: jest.fn(),
      getEventsSince: jest.fn(),
    }
  }

  it('reuses an active run for the same normalized intent', async () => {
    const { JobSearchOrchestrator } = require('./job-search.orchestrator')

    const prisma = {
      jobQueryCache: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
      jobExtractionCache: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    }
    const valyuSearch = { discoverJobCandidates: jest.fn() }
    const runStore = createRunStore()
    runStore.findActiveRunByIntentHash.mockReturnValue({ runId: 'existing-run' })

    const orchestrator = new JobSearchOrchestrator(prisma as any, valyuSearch as any, runStore as any)
    const run = await orchestrator.startRun({
      query: 'Backend Engineer OR Platform Engineer remote',
      maxNumResults: 10,
      sourceScope: 'global',
      remote: true,
    })

    expect(run).toEqual({ runId: 'existing-run' })
    expect(runStore.createRun).not.toHaveBeenCalled()
  })

  it('returns normalized-intent cached results for smaller follow-up requests', async () => {
    const { JobSearchOrchestrator } = require('./job-search.orchestrator')

    const prisma = {
      jobQueryCache: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({
          payload: Array.from({ length: 10 }).map((_, index) => ({
            id: `job-${index + 1}`,
            title: `Backend Engineer ${index + 1}`,
            organization: 'Acme',
            location: 'Remote',
            fitScore: 'High',
            tags: ['Greenhouse'],
            link: `https://job-boards.greenhouse.io/acme/jobs/${index + 1}`,
            status: 'new',
            sourceName: 'Greenhouse',
            sourceDomain: 'job-boards.greenhouse.io',
            sourceType: 'ats',
            sourceVerified: true,
            queueStatus: 'ready',
            queuePosition: index + 1,
          })),
          expiresAt: new Date(Date.now() + 60_000),
          updatedAt: new Date(Date.now() - 30_000),
        }),
      },
      jobExtractionCache: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    }
    const orchestrator = new JobSearchOrchestrator(prisma as any, {} as any, createRunStore() as any)

    const cached = await orchestrator.getCachedSearchResults({
      query: 'platform engineer OR backend engineer',
      maxNumResults: 5,
      sourceScope: 'global',
    })

    expect(cached?.cache.mode).toBe('intent')
    expect(cached?.results).toHaveLength(5)
    expect(cached?.results[0]?.queuePosition).toBe(1)
    expect(cached?.results[4]?.queuePosition).toBe(5)
  })

  it('replays cached results and does not overwrite a healthy cache with an empty refresh', async () => {
    const { JobSearchOrchestrator } = require('./job-search.orchestrator')

    const prisma = {
      jobQueryCache: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({
          payload: [
            {
              id: 'cached-job',
              title: 'Backend Engineer',
              organization: 'Acme',
              location: 'Remote',
              fitScore: 'High',
              tags: ['Greenhouse'],
              link: 'https://job-boards.greenhouse.io/acme/jobs/1',
              status: 'new',
              sourceName: 'Greenhouse',
              sourceDomain: 'job-boards.greenhouse.io',
              sourceType: 'ats',
              sourceVerified: true,
              queueStatus: 'ready',
              queuePosition: 1,
            },
          ],
          expiresAt: new Date(Date.now() + 60_000),
          updatedAt: new Date(Date.now() - 30_000),
        }),
        upsert: jest.fn(),
      },
      jobExtractionCache: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    }
    const valyuSearch = {
      discoverJobCandidates: jest.fn().mockResolvedValue([]),
    }
    const runStore = createRunStore()

    const orchestrator = new JobSearchOrchestrator(prisma as any, valyuSearch as any, runStore as any)

    await orchestrator.startRun({
      query: 'backend engineer',
      maxNumResults: 10,
      sourceScope: 'global',
    })

    await flushAsync()

    expect(runStore.appendEvent).toHaveBeenCalledWith(
      'run-1',
      'run_cache_hit',
      expect.objectContaining({ cache: expect.objectContaining({ mode: 'intent', refreshing: true }) }),
    )
    expect(runStore.appendEvent).toHaveBeenCalledWith(
      'run-1',
      'candidate_ready',
      expect.objectContaining({ cacheHit: true }),
    )
    expect(prisma.jobQueryCache.upsert).not.toHaveBeenCalled()
    expect(runStore.setStatus).toHaveBeenCalledWith('run-1', 'completed')
  })
})

describe('JobSearchOrchestrator timeout handling', () => {
  const originalTimeout = process.env.JOB_SEARCH_RUN_TIMEOUT_MS

  afterEach(() => {
    if (originalTimeout === undefined) {
      delete process.env.JOB_SEARCH_RUN_TIMEOUT_MS
    } else {
      process.env.JOB_SEARCH_RUN_TIMEOUT_MS = originalTimeout
    }
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('marks a timed out run as failed without emitting run_completed', async () => {
    process.env.JOB_SEARCH_RUN_TIMEOUT_MS = '1'
    jest.resetModules()

    const { JobSearchOrchestrator } = require('./job-search.orchestrator')

    const prisma = {
      jobQueryCache: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      jobExtractionCache: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    }

    const valyuSearch = {
      discoverJobCandidates: jest.fn().mockImplementation(
        async () =>
          await new Promise((resolve) =>
            setTimeout(
              () =>
                resolve([
                  {
                    id: 'candidate-1',
                    title: 'AI Engineer',
                    url: 'https://www.indeed.com/viewjob?jk=abc123',
                    snippet: 'Build AI systems.',
                    relevance: 0.9,
                    sourceName: 'Indeed',
                    sourceDomain: 'indeed.com',
                    sourceType: 'job_board',
                    sourceVerified: true,
                  },
                ]),
              5,
            ),
          ),
      ),
    }

    const runStore = {
      createRun: jest.fn().mockResolvedValue({ runId: 'run-1' }),
      findActiveRunByIntentHash: jest.fn().mockReturnValue(null),
      upsertResult: jest.fn().mockResolvedValue(undefined),
      appendEvent: jest.fn().mockResolvedValue(null),
      setStatus: jest.fn().mockResolvedValue(undefined),
      setCacheState: jest.fn().mockResolvedValue(undefined),
      isStopRequested: jest.fn().mockReturnValue(false),
      requestStop: jest.fn().mockReturnValue(true),
      getSnapshot: jest.fn(),
      getEventsSince: jest.fn(),
    }

    const orchestrator = new JobSearchOrchestrator(prisma as any, valyuSearch as any, runStore as any)

    await orchestrator.startRun({
      query: 'ai engineer',
      maxNumResults: 1,
      sourceScope: 'global',
    })

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(runStore.appendEvent).toHaveBeenCalledWith(
      'run-1',
      'run_error',
      expect.objectContaining({ code: 'timeout' }),
    )
    expect(runStore.setStatus).toHaveBeenCalledWith('run-1', 'failed')
    expect(runStore.appendEvent).not.toHaveBeenCalledWith(
      'run-1',
      'run_completed',
      expect.anything(),
    )
  })

  it('does not apply a run timeout by default when the env is unset', async () => {
    delete process.env.JOB_SEARCH_RUN_TIMEOUT_MS
    jest.resetModules()

    const { JobSearchOrchestrator } = require('./job-search.orchestrator')

    const prisma = {
      jobQueryCache: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      jobExtractionCache: {
        findUnique: jest.fn().mockResolvedValue({
          payload: {
            title: 'Senior Backend Engineer',
            company: 'Acme',
            location: 'Remote',
            requirements: ['TypeScript'],
          },
          expiresAt: new Date(Date.now() + 60_000),
        }),
        upsert: jest.fn(),
      },
    }

    const valyuSearch = {
      discoverJobCandidates: jest.fn().mockResolvedValue([
        {
          id: 'candidate-1',
          title: 'Senior Backend Engineer',
          url: 'https://www.indeed.com/viewjob?jk=abc123',
          snippet: 'Build APIs.',
          relevance: 0.9,
          sourceName: 'Indeed',
          sourceDomain: 'indeed.com',
          sourceType: 'job_board',
          sourceVerified: true,
        },
      ]),
    }

    const runStore = {
      createRun: jest.fn().mockResolvedValue({ runId: 'run-1' }),
      findActiveRunByIntentHash: jest.fn().mockReturnValue(null),
      upsertResult: jest.fn().mockImplementation(async (_runId, result) => result),
      appendEvent: jest.fn().mockResolvedValue(null),
      setStatus: jest.fn().mockResolvedValue(undefined),
      setCacheState: jest.fn().mockResolvedValue(undefined),
      isStopRequested: jest.fn().mockReturnValue(false),
      requestStop: jest.fn().mockReturnValue(true),
      getSnapshot: jest.fn(),
      getEventsSince: jest.fn(),
    }

    const orchestrator = new JobSearchOrchestrator(prisma as any, valyuSearch as any, runStore as any)

    await orchestrator.startRun({
      query: 'backend engineer',
      maxNumResults: 1,
      sourceScope: 'global',
      userId: 'user-1',
    })

    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))

    expect(runStore.appendEvent).not.toHaveBeenCalledWith(
      'run-1',
      'run_error',
      expect.objectContaining({ code: 'timeout' }),
    )
    expect(runStore.setStatus).toHaveBeenCalledWith('run-1', 'completed')
  })
})
