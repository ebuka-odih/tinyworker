const runTinyfishBatch = jest.fn()
const waitForTinyfishRunCompletion = jest.fn()
const runTinyfishWithFallback = jest.fn()
const extractTinyfishRunPayload = jest.fn((run: any) => {
  if (!run || typeof run !== 'object') return null
  return run.result ?? run.result_json ?? run.resultJson ?? run.data?.result ?? run.data?.result_json ?? run.data?.resultJson ?? null
})

jest.mock('../tinyfish/tinyfish.client', () => ({
  runTinyfishBatch: (...args: any[]) => runTinyfishBatch(...args),
  waitForTinyfishRunCompletion: (...args: any[]) => waitForTinyfishRunCompletion(...args),
  runTinyfishWithFallback: (...args: any[]) => runTinyfishWithFallback(...args),
  extractTinyfishRunPayload: (...args: any[]) => extractTinyfishRunPayload(...args),
}))

describe('ScholarshipSearchOrchestrator run creation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      SCHOLARSHIP_DISCOVERY_MAX_CANDIDATES: '12',
      SCHOLARSHIP_TINYFISH_MAX_RUNS_PER_SEARCH: '4',
      SCHOLARSHIP_TINYFISH_MAX_RUNS_PER_DOMAIN: '2',
      SCHOLARSHIP_SOURCE_SCOUT_ENABLED: 'false',
    }
  })

  afterAll(() => {
    process.env = originalEnv
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
      isStopRequested: jest.fn().mockReturnValue(false),
      requestStop: jest.fn().mockReturnValue(true),
      getSnapshot: jest.fn(),
      getEventsSince: jest.fn(),
    }
  }

  function createSearchQuota() {
    return {
      consumeRunAllowance: jest.fn().mockResolvedValue({ consumed: false, usageDate: new Date('2026-03-08T00:00:00.000Z') }),
      releaseConsumedRunAllowance: jest.fn().mockResolvedValue(undefined),
    }
  }

  it('creates a persisted scholarship run only when a new run actually starts', async () => {
    const { ScholarshipSearchOrchestrator } = require('./scholarship-search.orchestrator')

    const prisma = {
      jobExtractionCache: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    }
    const valyuSearch = {
      discoverScholarshipCandidates: jest.fn().mockResolvedValue([]),
    }
    const runStore = createRunStore()

    const orchestrator = new ScholarshipSearchOrchestrator(prisma as any, valyuSearch as any, runStore as any, createSearchQuota() as any)

    await orchestrator.startRun({
      userId: 'user-1',
      query: 'commonwealth scholarship',
      maxNumResults: 5,
      sourceScope: 'global',
    })

    await flushAsync()

    expect(runStore.createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        runKind: 'scholarship',
        query: 'commonwealth scholarship',
      }),
    )

    runStore.findActiveRunByIntentHash.mockReturnValue({ runId: 'existing-run' })
    const existing = await orchestrator.startRun({
      userId: 'user-1',
      query: 'commonwealth scholarship',
      maxNumResults: 5,
      sourceScope: 'global',
    })

    expect(existing).toEqual({ runId: 'existing-run' })
    expect(runStore.createRun).toHaveBeenCalledTimes(1)
  })

  it('caps scholarship TinyFish fanout and uses batch extraction for the shortlist only', async () => {
    const { ScholarshipSearchOrchestrator } = require('./scholarship-search.orchestrator')

    const prisma = {
      jobExtractionCache: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    }
    const valyuSearch = {
      discoverScholarshipCandidates: jest.fn().mockResolvedValue([
        {
          id: 'shared-a',
          title: 'Commonwealth Shared Scholarships 2026/2027',
          url: 'https://cscuk.fcdo.gov.uk/scholarships/commonwealth-shared-scholarships/',
          snippet: 'Shared scholarship detail page.',
          relevance: 0.95,
          sourceName: 'Commonwealth Scholarships',
          sourceDomain: 'cscuk.fcdo.gov.uk',
          sourceType: 'company_careers',
          sourceVerified: true,
        },
        {
          id: 'shared-b',
          title: 'Commonwealth Shared Scholarship',
          url: 'https://cscuk.fcdo.gov.uk/scholarships/commonwealth-shared-scholarship/',
          snippet: 'Same scholarship family on the same domain.',
          relevance: 0.93,
          sourceName: 'Commonwealth Scholarships',
          sourceDomain: 'cscuk.fcdo.gov.uk',
          sourceType: 'company_careers',
          sourceVerified: true,
        },
        {
          id: 'distance',
          title: 'Commonwealth Distance Learning Scholarships 2026/2027',
          url: 'https://cscuk.fcdo.gov.uk/scholarships/commonwealth-distance-learning-scholarships/',
          snippet: 'Distance learning scholarship.',
          relevance: 0.9,
          sourceName: 'Commonwealth Scholarships',
          sourceDomain: 'cscuk.fcdo.gov.uk',
          sourceType: 'company_careers',
          sourceVerified: true,
        },
        {
          id: 'masters',
          title: 'Commonwealth Master’s Scholarships 2026/2027',
          url: 'https://cscuk.fcdo.gov.uk/scholarships/commonwealth-masters-scholarships/',
          snippet: 'Masters scholarship.',
          relevance: 0.88,
          sourceName: 'Commonwealth Scholarships',
          sourceDomain: 'cscuk.fcdo.gov.uk',
          sourceType: 'company_careers',
          sourceVerified: true,
        },
        {
          id: 'chevening-main',
          title: 'Chevening Scholarships 2026/2027',
          url: 'https://www.chevening.org/scholarships/chevening-scholarships/',
          snippet: 'Chevening scholarship.',
          relevance: 0.87,
          sourceName: 'Chevening',
          sourceDomain: 'chevening.org',
          sourceType: 'company_careers',
          sourceVerified: true,
        },
        {
          id: 'chevening-fellowship',
          title: 'Chevening Fellowships 2026/2027',
          url: 'https://www.chevening.org/scholarships/chevening-fellowships/',
          snippet: 'Chevening fellowship.',
          relevance: 0.86,
          sourceName: 'Chevening',
          sourceDomain: 'chevening.org',
          sourceType: 'company_careers',
          sourceVerified: true,
        },
      ]),
    }
    const runStore = createRunStore()

    runTinyfishBatch.mockResolvedValue({
      run_ids: ['tf-1', 'tf-2', 'tf-3', 'tf-4'],
    })
    waitForTinyfishRunCompletion.mockResolvedValue({
      status: 'COMPLETED',
      result: {
        title: 'Commonwealth Scholarship',
        provider: 'Commonwealth Scholarships',
        destination: 'United Kingdom',
        study_level: 'Master',
        funding_type: 'Fully funded',
        summary: 'Structured scholarship detail.',
      },
    })

    const orchestrator = new ScholarshipSearchOrchestrator(prisma as any, valyuSearch as any, runStore as any, createSearchQuota() as any)

    await orchestrator.startRun({
      userId: 'user-1',
      query: 'fully funded commonwealth scholarship',
      maxNumResults: 10,
      sourceScope: 'global',
    })

    await flushAsync()

    expect(runTinyfishBatch).toHaveBeenCalledTimes(1)
    const batchRequests = runTinyfishBatch.mock.calls[0]?.[0] || []
    expect(batchRequests).toHaveLength(4)
    expect(
      batchRequests.filter((request: { url: string }) => request.url.includes('cscuk.fcdo.gov.uk')).length,
    ).toBeLessThanOrEqual(2)
    expect(runTinyfishWithFallback).not.toHaveBeenCalled()
    expect(runStore.appendEvent).toHaveBeenCalledWith(
      'run-1',
      'run_progress',
      expect.objectContaining({
        stage: 'discovery',
        metrics: expect.objectContaining({
          discovered: 6,
          filteredOut: 2,
          selectedForExtraction: 4,
          extractionBudget: expect.objectContaining({
            maxRunsPerSearch: 4,
            maxRunsPerDomain: 2,
            maxRunsPerFamily: 1,
          }),
        }),
      }),
    )
    expect(
      runStore.appendEvent.mock.calls.filter(([, type]: [string, string]) => type === 'candidate_queued'),
    ).toHaveLength(4)
  })

  it('reads extracted scholarship payloads from TinyFish batch run data.result', async () => {
    const { ScholarshipSearchOrchestrator } = require('./scholarship-search.orchestrator')

    const prisma = {
      jobExtractionCache: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    }
    const valyuSearch = {
      discoverScholarshipCandidates: jest.fn().mockResolvedValue([
        {
          id: 'sch-1',
          title: 'Commonwealth Master’s Scholarships 2026/2027',
          url: 'https://cscuk.fcdo.gov.uk/scholarships/commonwealth-masters-scholarships/',
          snippet: 'Scholarship detail page.',
          relevance: 0.94,
          sourceName: 'Commonwealth Scholarships',
          sourceDomain: 'cscuk.fcdo.gov.uk',
          sourceType: 'company_careers',
          sourceVerified: true,
        },
      ]),
    }
    const runStore = createRunStore()

    runTinyfishBatch.mockResolvedValue({
      run_ids: ['tf-data-1'],
    })
    waitForTinyfishRunCompletion.mockResolvedValue({
      status: 'COMPLETED',
      data: {
        result: {
          title: 'Commonwealth Master’s Scholarships 2026/2027',
          provider: 'Commonwealth Scholarships',
          destination: 'United Kingdom',
          deadline: '2026-12-01',
          study_level: 'Master',
          funding_type: 'Fully funded',
          summary: 'Fully funded scholarship for master’s study in the UK.',
        },
      },
    })

    const orchestrator = new ScholarshipSearchOrchestrator(prisma as any, valyuSearch as any, runStore as any, createSearchQuota() as any)

    await orchestrator.startRun({
      userId: 'user-1',
      query: 'commonwealth masters scholarship',
      maxNumResults: 3,
      sourceScope: 'global',
    })

    await flushAsync()

    const readyCall = runStore.appendEvent.mock.calls.find(([, type]: [string, string]) => type === 'candidate_ready')
    expect(readyCall).toBeTruthy()
    expect(readyCall?.[2]).toEqual(
      expect.objectContaining({
        result: expect.objectContaining({
          organization: 'Commonwealth Scholarships',
          location: 'United Kingdom',
          deadline: '2026-12-01',
          studyLevel: 'Master',
          fundingType: 'Fully funded',
          queueStatus: 'ready',
        }),
      }),
    )
  })
})
