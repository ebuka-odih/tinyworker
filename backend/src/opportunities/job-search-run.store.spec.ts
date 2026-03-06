import { JobSearchRunStore } from './job-search-run.store'

describe('JobSearchRunStore persisted snapshots', () => {
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
})
