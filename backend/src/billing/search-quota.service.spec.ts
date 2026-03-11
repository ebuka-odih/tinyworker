import { HttpException } from '@nestjs/common'
import { SearchQuotaService } from './search-quota.service'

function createConfig() {
  const values: Record<string, string> = {
    BILLING_ENABLED: 'true',
    FREE_DAILY_SEARCH_LIMIT: '2',
    PAYSTACK_PRO_WEEKLY_PLAN_CODE: 'PLN_weekly',
    PAYSTACK_PRO_MONTHLY_PLAN_CODE: 'PLN_monthly',
    POLAR_PRO_WEEKLY_PRODUCT_ID: 'prod_weekly',
    POLAR_PRO_MONTHLY_PRODUCT_ID: 'prod_monthly',
  }

  return {
    get: (key: string) => values[key],
  }
}

function createService(initialUsage = 0, subscriptionStatus?: string) {
  const usageByDate = new Map<string, any>()
  if (initialUsage > 0) {
      usageByDate.set(new Date(Date.UTC(2026, 2, 8)).toISOString(), {
        id: 'usage-1',
        userId: 'user-1',
        usageDate: new Date(Date.UTC(2026, 2, 8)),
        runsConsumed: initialUsage,
        jobRunsConsumed: initialUsage,
        scholarshipRunsConsumed: 0,
        grantRunsConsumed: 0,
        visaRunsConsumed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
  }

  const getUsageByWhere = (where: any) =>
    usageByDate.get(new Date(where.userId_usageDate.usageDate).toISOString()) || null

  const dailySearchUsage = {
    findUnique: jest.fn().mockImplementation(({ where }: any) => getUsageByWhere(where)),
    update: jest.fn().mockImplementation(async ({ where, data }: any) => {
      const existing = getUsageByWhere(where)
      const next = {
        ...(existing as any),
        ...data,
      }
      usageByDate.set(new Date(where.userId_usageDate.usageDate).toISOString(), next)
      return next
    }),
  }

  const prisma = {
    subscription: {
      findMany: jest.fn().mockResolvedValue(
        subscriptionStatus
          ? [
              {
                id: 'sub-1',
                userId: 'user-1',
                provider: 'paystack',
                tier: 'pro',
                interval: 'monthly',
                currency: 'NGN',
                amountMinor: 500000,
                providerSubscriptionId: 'SUB_1',
                status: subscriptionStatus,
                cancelAtPeriodEnd: false,
                currentPeriodEnd: new Date('2026-04-01T00:00:00.000Z'),
                updatedAt: new Date(),
              },
            ]
          : [],
      ),
    },
    dailySearchUsage,
    $transaction: jest.fn().mockImplementation(async (callback: any) => {
      return await callback({
        dailySearchUsage: {
          findUnique: jest.fn().mockImplementation(({ where }: any) => getUsageByWhere(where)),
          upsert: jest.fn().mockImplementation(async ({ create, update }: any) => {
            const key = new Date(create.usageDate).toISOString()
            const existing = usageByDate.get(key)
            if (existing) {
              const next = {
                ...existing,
                runsConsumed: existing.runsConsumed + Number(update.runsConsumed?.increment || 0),
                jobRunsConsumed: existing.jobRunsConsumed + Number(update.jobRunsConsumed?.increment || 0),
                scholarshipRunsConsumed:
                  existing.scholarshipRunsConsumed + Number(update.scholarshipRunsConsumed?.increment || 0),
                grantRunsConsumed: existing.grantRunsConsumed + Number(update.grantRunsConsumed?.increment || 0),
                visaRunsConsumed: existing.visaRunsConsumed + Number(update.visaRunsConsumed?.increment || 0),
                updatedAt: new Date(),
              }
              usageByDate.set(key, next)
              return next
            }

            const next = {
              id: 'usage-1',
              createdAt: new Date(),
              updatedAt: new Date(),
              ...create,
            }
            usageByDate.set(key, next)
            return next
          }),
        },
      })
    }),
  }

  return {
    service: new SearchQuotaService(prisma as any, createConfig() as any),
    prisma,
    getUsage: (date = new Date(Date.UTC(2026, 2, 8))) => usageByDate.get(date.toISOString()) || null,
  }
}

describe('SearchQuotaService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-08T12:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('allows the first two free runs and blocks the third', async () => {
    const { service, getUsage } = createService()

    await expect(service.consumeRunAllowance('user-1', 'job')).resolves.toEqual(
      expect.objectContaining({ consumed: true }),
    )
    await expect(service.consumeRunAllowance('user-1', 'job')).resolves.toEqual(
      expect.objectContaining({ consumed: true }),
    )
    await expect(service.consumeRunAllowance('user-1', 'job')).rejects.toBeInstanceOf(HttpException)
    expect(getUsage()?.runsConsumed).toBe(2)
  })

  it('resets free usage on the next UTC day', async () => {
    const { service } = createService(2)

    jest.setSystemTime(new Date('2026-03-09T01:00:00.000Z'))
    await expect(service.consumeRunAllowance('user-1', 'job')).resolves.toEqual(
      expect.objectContaining({ consumed: true }),
    )
  })

  it('bypasses quota for active paid subscriptions', async () => {
    const { service, getUsage } = createService(2, 'active')

    await expect(service.consumeRunAllowance('user-1', 'job')).resolves.toEqual(
      expect.objectContaining({ consumed: false }),
    )
    expect(getUsage()?.runsConsumed).toBe(2)
  })

  it('tracks grant and visa counters independently', async () => {
    const { service, getUsage } = createService()

    await expect(service.consumeRunAllowance('user-1', 'grant')).resolves.toEqual(
      expect.objectContaining({ consumed: true }),
    )
    await expect(service.consumeRunAllowance('user-1', 'visa')).resolves.toEqual(
      expect.objectContaining({ consumed: true }),
    )

    expect(getUsage()).toEqual(
      expect.objectContaining({
        runsConsumed: 2,
        jobRunsConsumed: 0,
        scholarshipRunsConsumed: 0,
        grantRunsConsumed: 1,
        visaRunsConsumed: 1,
      }),
    )
  })
})
