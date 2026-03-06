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
    process.env.JOB_SEARCH_RUN_TIMEOUT_MS = '0'
    jest.resetModules()

    const { JobSearchOrchestrator } = require('./job-search.orchestrator')

    const prisma = {
      jobQueryCache: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      jobExtractionCache: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    }

    const valyuSearch = {
      discoverJobCandidates: jest.fn().mockResolvedValue([
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
    }

    const runStore = {
      createRun: jest.fn().mockResolvedValue({ runId: 'run-1' }),
      upsertResult: jest.fn().mockResolvedValue(undefined),
      appendEvent: jest.fn().mockResolvedValue(null),
      setStatus: jest.fn().mockResolvedValue(undefined),
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

    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))

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
})
