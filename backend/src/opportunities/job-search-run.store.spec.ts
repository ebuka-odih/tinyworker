import { JobSearchRunStore } from './job-search-run.store'

describe('JobSearchRunStore persisted snapshots', () => {
  it('persists run kind when a new executable run is created', async () => {
    const prisma = {
      jobSearchRun: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      jobSearchRunEvent: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    }

    const store = new JobSearchRunStore(prisma as any)
    const { runId } = await store.createRun({
      userId: 'user-1',
      runKind: 'scholarship',
      query: 'commonwealth scholarship',
      queryHash: 'q-scholarship',
      intentHash: 'i-scholarship',
      sourceScope: 'global',
    })

    expect(prisma.jobSearchRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: runId,
        userId: 'user-1',
        runKind: 'scholarship',
        query: 'commonwealth scholarship',
      }),
    })

    const snapshot = await store.getSnapshot(runId, 'user-1')
    expect(snapshot).toEqual(
      expect.objectContaining({
        runId,
        runKind: 'scholarship',
      }),
    )
  })

  it('reconstructs merged results from persisted run events', async () => {
    const prisma = {
      jobSearchRun: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'run-1',
          userId: 'user-1',
          query: 'backend engineer',
          countryCode: 'DE',
          sourceScope: 'global',
          status: 'running',
          startedAt: new Date('2026-03-06T10:00:00.000Z'),
          completedAt: null,
          stoppedAt: null,
          lastSequence: 4,
          totalQueued: 1,
          totalReady: 1,
          totalFailed: 1,
        }),
      },
      jobSearchRunEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'evt-1',
            runId: 'run-1',
            sequence: 1,
            type: 'candidate_queued',
            payload: {
              result: {
                id: 'job-1',
                title: 'Backend Engineer',
                organization: 'Acme',
                location: 'Remote',
                fitScore: 'Low',
                tags: ['Indeed'],
                link: 'https://indeed.com/viewjob?jk=1',
                status: 'new',
                sourceName: 'Indeed',
                sourceDomain: 'indeed.com',
                sourceType: 'job_board',
                sourceVerified: true,
                queueStatus: 'queued',
                relevance: 0.9,
              },
            },
            createdAt: new Date('2026-03-06T10:00:00.000Z'),
          },
          {
            id: 'evt-2',
            runId: 'run-1',
            sequence: 2,
            type: 'candidate_ready',
            payload: {
              result: {
                id: 'job-1',
                title: 'Senior Backend Engineer',
                organization: 'Acme',
                location: 'Remote',
                fitScore: 'Low',
                tags: ['Indeed'],
                link: 'https://indeed.com/viewjob?jk=1',
                status: 'new',
                sourceName: 'Indeed',
                sourceDomain: 'indeed.com',
                sourceType: 'job_board',
                sourceVerified: true,
                queueStatus: 'ready',
                relevance: 0.9,
                matchReason: 'Strong backend fit',
                requirements: ['TypeScript'],
              },
            },
            createdAt: new Date('2026-03-06T10:00:05.000Z'),
          },
          {
            id: 'evt-3',
            runId: 'run-1',
            sequence: 3,
            type: 'candidate_failed',
            payload: {
              result: {
                id: 'job-2',
                title: 'Platform Engineer',
                organization: 'Contoso',
                location: 'Berlin',
                fitScore: 'Low',
                tags: ['Greenhouse'],
                link: 'https://boards.greenhouse.io/contoso/jobs/2',
                status: 'new',
                sourceName: 'Greenhouse',
                sourceDomain: 'greenhouse.io',
                sourceType: 'ats',
                sourceVerified: true,
                queueStatus: 'failed',
                relevance: 0.7,
                snippet: 'Extraction failed',
              },
            },
            createdAt: new Date('2026-03-06T10:00:10.000Z'),
          },
          {
            id: 'evt-4',
            runId: 'run-1',
            sequence: 4,
            type: 'run_cache_hit',
            payload: {
              cache: {
                mode: 'intent',
                cachedAt: '2026-03-06T09:30:00.000Z',
                ageMs: 1_800_000,
                refreshing: true,
              },
            },
            createdAt: new Date('2026-03-06T10:00:15.000Z'),
          },
        ]),
      },
    }

    const store = new JobSearchRunStore(prisma as any)
    const snapshot = await store.getSnapshot('run-1', 'user-1')

    expect(snapshot).not.toBeNull()
    expect(snapshot?.results).toHaveLength(2)
    expect(snapshot?.results?.[0]).toEqual(
      expect.objectContaining({
        id: 'job-1',
        title: 'Senior Backend Engineer',
        queueStatus: 'ready',
        matchReason: 'Strong backend fit',
        requirements: ['TypeScript'],
        fitScore: 'High',
        queuePosition: 1,
      }),
    )
    expect(snapshot?.counts).toEqual({ queued: 0, ready: 1, failed: 1 })
    expect(snapshot?.cache).toEqual(expect.objectContaining({ mode: 'intent', refreshing: true }))
  })

  it('collapses equivalent jobs from different sources into one stored result', async () => {
    const prisma = {
      jobSearchRun: {
        create: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      },
      jobSearchRunEvent: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    }

    const store = new JobSearchRunStore(prisma as any)
    const { runId } = await store.createRun({
      userId: 'user-1',
      query: 'staff backend engineer',
      queryHash: 'q1',
      intentHash: 'i1',
      countryCode: 'US',
      sourceScope: 'global',
    })

    await store.upsertResult(runId, {
      id: 'lever-job',
      title: 'Staff Backend Engineer, AI Platform',
      organization: 'Home Solutions',
      location: 'Raleigh or Charlotte, NC or Remote',
      fitScore: 'Low',
      tags: ['Lever'],
      link: 'https://jobs.lever.co/home-solutions/123',
      status: 'new',
      sourceName: 'Lever',
      sourceDomain: 'jobs.lever.co',
      sourceType: 'ats',
      sourceVerified: true,
      queueStatus: 'ready',
      relevance: 0.82,
      matchReason: 'Backend platform match',
      requirements: ['Go', 'AWS'],
    })

    const merged = await store.upsertResult(runId, {
      id: 'greenhouse-job',
      title: 'Staff Backend Engineer, AI Platform',
      organization: 'Home Solutions',
      location: 'Raleigh or Charlotte, NC, or Remote',
      fitScore: 'Low',
      tags: ['Greenhouse'],
      link: 'https://job-boards.greenhouse.io/home-solutions/jobs/456',
      status: 'new',
      sourceName: 'Greenhouse',
      sourceDomain: 'job-boards.greenhouse.io',
      sourceType: 'ats',
      sourceVerified: true,
      queueStatus: 'ready',
      relevance: 0.8,
      snippet: 'Architect and scale AI-powered customer acquisition systems.',
      responsibilities: ['Design backend systems'],
      benefits: ['Remote'],
    })

    expect(merged).toEqual(
      expect.objectContaining({
        id: 'lever-job',
        title: 'Staff Backend Engineer, AI Platform',
        organization: 'Home Solutions',
        tags: expect.arrayContaining(['Lever', 'Greenhouse']),
        requirements: ['Go', 'AWS'],
        responsibilities: ['Design backend systems'],
        benefits: ['Remote'],
        seenOn: expect.arrayContaining([
          expect.objectContaining({ sourceName: 'Lever', sourceDomain: 'jobs.lever.co' }),
          expect.objectContaining({ sourceName: 'Greenhouse', sourceDomain: 'job-boards.greenhouse.io' }),
        ]),
      }),
    )

    const snapshot = await store.getSnapshot(runId, 'user-1')
    expect(snapshot?.results).toHaveLength(1)
    expect(snapshot?.counts).toEqual({ queued: 0, ready: 1, failed: 0 })
  })

  it('keeps terminal failed state instead of leaving results stuck in extracting', async () => {
    const prisma = {
      jobSearchRun: {
        create: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      },
      jobSearchRunEvent: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    }

    const store = new JobSearchRunStore(prisma as any)
    const { runId } = await store.createRun({
      userId: 'user-1',
      query: 'commonwealth scholarship',
      queryHash: 'q2',
      intentHash: 'i2',
      sourceScope: 'global',
    })

    await store.upsertResult(runId, {
      id: 'sch-1',
      opportunityType: 'scholarship',
      title: 'Applicant Advice Commonwealth Scholarship Commission in the UK',
      organization: 'Commonwealth Scholarships',
      location: 'Global',
      fitScore: 'High',
      tags: ['Scholarship'],
      link: 'https://cscuk.fcdo.gov.uk/applicant-advice/',
      status: 'new',
      sourceName: 'Commonwealth Scholarships',
      sourceDomain: 'cscuk.fcdo.gov.uk',
      sourceType: 'company_careers',
      sourceVerified: true,
      queueStatus: 'extracting',
      relevance: 0.9,
      snippet: 'Advice page',
    })

    const updated = await store.upsertResult(runId, {
      id: 'sch-1',
      opportunityType: 'scholarship',
      title: 'Applicant Advice Commonwealth Scholarship Commission in the UK',
      organization: 'Commonwealth Scholarships',
      location: 'Global',
      fitScore: 'High',
      tags: ['Scholarship'],
      link: 'https://cscuk.fcdo.gov.uk/applicant-advice/',
      status: 'new',
      sourceName: 'Commonwealth Scholarships',
      sourceDomain: 'cscuk.fcdo.gov.uk',
      sourceType: 'company_careers',
      sourceVerified: true,
      queueStatus: 'failed',
      relevance: 0.9,
      snippet: 'TinyFish did not extract enough scholarship detail from this page.',
    })

    expect(updated).toEqual(
      expect.objectContaining({
        id: 'sch-1',
        queueStatus: 'failed',
      }),
    )

    const snapshot = await store.getSnapshot(runId, 'user-1')
    expect(snapshot?.counts).toEqual({ queued: 0, ready: 0, failed: 1 })
    expect(snapshot?.results?.[0]).toEqual(
      expect.objectContaining({
        id: 'sch-1',
        queueStatus: 'failed',
      }),
    )
  })

  it('surfaces the latest run metrics in snapshots', async () => {
    const prisma = {
      jobSearchRun: {
        create: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      },
      jobSearchRunEvent: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    }

    const store = new JobSearchRunStore(prisma as any)
    const { runId } = await store.createRun({
      userId: 'user-1',
      runKind: 'scholarship',
      query: 'commonwealth scholarship',
      queryHash: 'q3',
      intentHash: 'i3',
      sourceScope: 'global',
    })

    await store.appendEvent(runId, 'run_progress', {
      stage: 'discovery',
      ready: 0,
      failed: 0,
      queued: 4,
      metrics: {
        discovered: 11,
        filteredOut: 7,
        selectedForExtraction: 4,
        extractedReady: 0,
        extractedFailed: 0,
        extractionBudget: {
          maxRunsPerSearch: 4,
          maxRunsPerDomain: 2,
          maxRunsPerFamily: 1,
          sourceScoutEnabled: false,
        },
      },
    })

    const snapshot = await store.getSnapshot(runId, 'user-1')
    expect(snapshot?.metrics).toEqual(
      expect.objectContaining({
        discovered: 11,
        filteredOut: 7,
        selectedForExtraction: 4,
        extractionBudget: expect.objectContaining({
          maxRunsPerSearch: 4,
          maxRunsPerDomain: 2,
          maxRunsPerFamily: 1,
        }),
      }),
    )
  })
})
