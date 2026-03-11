const runTinyfishWithFallback = jest.fn()

jest.mock('../tinyfish/tinyfish.client', () => ({
  runTinyfishWithFallback: (...args: any[]) => runTinyfishWithFallback(...args),
}))

describe('GrantSearchOrchestrator', () => {
  beforeEach(() => {
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
      isStopRequested: jest.fn().mockReturnValue(false),
      requestStop: jest.fn().mockReturnValue(true),
      getSnapshot: jest.fn(),
      getEventsSince: jest.fn(),
    }
  }

  it('creates a grant run and extracts ready grant details', async () => {
    const { GrantSearchOrchestrator } = require('./grant-search.orchestrator')

    const prisma = {
      jobExtractionCache: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    }
    const valyuSearch = {
      discoverGrantCandidates: jest.fn().mockResolvedValue([
        {
          id: 'grant-1',
          title: 'AI Innovation Grant 2026',
          url: 'https://wellcome.org/grant-funding/ai-innovation-grant-2026',
          snippet: 'Open AI grant.',
          relevance: 0.94,
          sourceName: 'Wellcome',
          sourceDomain: 'wellcome.org',
          sourceType: 'company_careers',
          sourceVerified: true,
        },
      ]),
    }
    const runStore = createRunStore()
    const searchQuota = {
      consumeRunAllowance: jest.fn().mockResolvedValue({ consumed: false, usageDate: new Date('2026-03-10T00:00:00.000Z') }),
      releaseConsumedRunAllowance: jest.fn().mockResolvedValue(undefined),
    }

    runTinyfishWithFallback.mockResolvedValue({
      result: {
        grant_name: 'AI Innovation Grant 2026',
        sponsor: 'Wellcome',
        funding_amount: '$50,000',
        who_can_apply: 'Researchers and startups',
        application_deadline: '2026-09-01',
        location_eligibility: 'Global',
        short_description: 'Funding for AI innovation pilots.',
        official_application_link: 'https://wellcome.org/apply/ai-innovation-grant-2026',
        status: 'Open',
      },
    })

    const orchestrator = new GrantSearchOrchestrator(prisma as any, valyuSearch as any, runStore as any, searchQuota as any)

    await orchestrator.startRun({
      userId: 'user-1',
      query: 'AI innovation grant',
      maxNumResults: 5,
      sourceScope: 'global',
    })

    await flushAsync()

    expect(runStore.createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        runKind: 'grant',
        query: 'AI innovation grant',
      }),
    )
    expect(runTinyfishWithFallback).toHaveBeenCalledTimes(1)
    expect(runStore.upsertResult).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        opportunityType: 'grant',
        queueStatus: 'ready',
        officialApplicationLink: 'https://wellcome.org/apply/ai-innovation-grant-2026',
      }),
    )
  })
})
