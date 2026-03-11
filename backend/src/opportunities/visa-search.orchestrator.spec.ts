const runTinyfishWithFallback = jest.fn()

jest.mock('../tinyfish/tinyfish.client', () => ({
  runTinyfishWithFallback: (...args: any[]) => runTinyfishWithFallback(...args),
}))

describe('VisaSearchOrchestrator', () => {
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

  it('creates a visa run and extracts ready visa details from official sources', async () => {
    const { VisaSearchOrchestrator } = require('./visa-search.orchestrator')

    const prisma = {
      jobExtractionCache: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    }
    const valyuSearch = {
      discoverVisaCandidates: jest.fn().mockResolvedValue([
        {
          id: 'visa-1',
          title: 'Skilled Worker visa',
          url: 'https://www.gov.uk/skilled-worker-visa',
          snippet: 'Official route page.',
          relevance: 0.98,
          sourceName: 'GOV.UK',
          sourceDomain: 'gov.uk',
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
        route_name: 'Skilled Worker visa',
        country: 'United Kingdom',
        who_can_apply: 'Applicants with an eligible job offer',
        eligibility_criteria: ['Sponsorship from a licensed employer'],
        required_documents: ['Certificate of sponsorship'],
        application_steps: ['Apply online'],
        processing_time: '3 weeks',
        official_link: 'https://www.gov.uk/skilled-worker-visa',
        status: 'Active',
      },
    })

    const orchestrator = new VisaSearchOrchestrator(prisma as any, valyuSearch as any, runStore as any, searchQuota as any)

    await orchestrator.startRun({
      userId: 'user-1',
      query: 'UK skilled worker visa',
      maxNumResults: 5,
      sourceScope: 'global',
    })

    await flushAsync()

    expect(runStore.createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        runKind: 'visa',
        query: 'UK skilled worker visa',
      }),
    )
    expect(runTinyfishWithFallback).toHaveBeenCalledTimes(1)
    expect(runStore.upsertResult).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        opportunityType: 'visa',
        queueStatus: 'ready',
        officialApplicationLink: 'https://www.gov.uk/skilled-worker-visa',
      }),
    )
  })
})
