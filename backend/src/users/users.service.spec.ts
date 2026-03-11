import { UsersService } from './users.service'

describe('UsersService authenticated user summary', () => {
  it('returns persisted per-user search run totals grouped by run kind', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
        }),
      },
      jobSearchRun: {
        count: jest
          .fn()
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(0),
      },
    }
    const billingService = {
      getBillingSnapshot: jest.fn().mockResolvedValue({
        subscriptionTier: 'free',
        billingStatus: 'inactive',
        provider: null,
        interval: null,
        currency: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      }),
    }
    const searchQuotaService = {
      getQuotaSnapshot: jest.fn().mockResolvedValue({
        dailyLimit: 2,
        usedToday: 0,
        remainingToday: 2,
        resetAt: '2026-03-09T00:00:00.000Z',
        unlimited: false,
      }),
    }

    const service = new UsersService(prisma as any, billingService as any, searchQuotaService as any)
    const summary = await service.getAuthenticatedUserSummary('user-1')

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, email: true },
    })
    expect(prisma.jobSearchRun.count).toHaveBeenNthCalledWith(1, {
      where: { userId: 'user-1' },
    })
    expect(prisma.jobSearchRun.count).toHaveBeenNthCalledWith(2, {
      where: { userId: 'user-1', runKind: 'job' },
    })
    expect(prisma.jobSearchRun.count).toHaveBeenNthCalledWith(3, {
      where: { userId: 'user-1', runKind: 'scholarship' },
    })
    expect(prisma.jobSearchRun.count).toHaveBeenNthCalledWith(4, {
      where: { userId: 'user-1', runKind: 'grant' },
    })
    expect(prisma.jobSearchRun.count).toHaveBeenNthCalledWith(5, {
      where: { userId: 'user-1', runKind: 'visa' },
    })
    expect(summary).toEqual({
      userId: 'user-1',
      email: 'user@example.com',
      subscriptionTier: 'free',
      billingStatus: 'inactive',
      billingProvider: null,
      billingInterval: null,
      billingCurrency: null,
      billingCurrentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      searchQuota: {
        dailyLimit: 2,
        usedToday: 0,
        remainingToday: 2,
        resetAt: '2026-03-09T00:00:00.000Z',
        unlimited: false,
      },
      searchRunSummary: {
        totalSearchesRun: 6,
        jobsRun: 3,
        scholarshipsRun: 2,
        grantsRun: 1,
        visasRun: 0,
      },
    })
  })
})
