import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { getConfiguredBillingPlans, getFreeDailySearchLimit } from './billing.catalog'
import { nextUtcResetAt, startOfUtcDay, subscriptionHasAccess } from './billing.utils'

export type SearchQuotaSnapshot = {
  dailyLimit: number | null
  usedToday: number
  remainingToday: number | null
  resetAt: string
  unlimited: boolean
}

type SearchRunKind = 'job' | 'scholarship' | 'grant' | 'visa'

@Injectable()
export class SearchQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isEnforcementEnabled() {
    return getConfiguredBillingPlans(this.config).length > 0
  }

  async getQuotaSnapshot(userId: string): Promise<SearchQuotaSnapshot> {
    const now = new Date()
    const resetAt = nextUtcResetAt(now).toISOString()

    if (!this.isEnforcementEnabled()) {
      return {
        dailyLimit: null,
        usedToday: 0,
        remainingToday: null,
        resetAt,
        unlimited: true,
      }
    }

    const [subscription, usage] = await Promise.all([
      this.getCurrentSubscription(userId),
      this.getUsageForDay(userId, startOfUtcDay(now)),
    ])

    if (subscriptionHasAccess(subscription, now)) {
      return {
        dailyLimit: getFreeDailySearchLimit(this.config),
        usedToday: usage?.runsConsumed || 0,
        remainingToday: null,
        resetAt,
        unlimited: true,
      }
    }

    const dailyLimit = getFreeDailySearchLimit(this.config)
    const usedToday = usage?.runsConsumed || 0
    return {
      dailyLimit,
      usedToday,
      remainingToday: Math.max(0, dailyLimit - usedToday),
      resetAt,
      unlimited: false,
    }
  }

  async consumeRunAllowance(userId: string, runKind: SearchRunKind) {
    const usageDate = startOfUtcDay(new Date())

    if (!this.isEnforcementEnabled()) {
      return { consumed: false, usageDate }
    }

    const subscription = await this.getCurrentSubscription(userId)
    if (subscriptionHasAccess(subscription)) {
      return { consumed: false, usageDate }
    }

    const dailyLimit = getFreeDailySearchLimit(this.config)
    const quota = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.dailySearchUsage.findUnique({
        where: {
          userId_usageDate: {
            userId,
            usageDate,
          },
        },
      })

      if ((existing?.runsConsumed || 0) >= dailyLimit) {
        return {
          blocked: true,
          runsConsumed: existing?.runsConsumed || 0,
        }
      }

      const next = await tx.dailySearchUsage.upsert({
        where: {
          userId_usageDate: {
            userId,
            usageDate,
          },
        },
        update: {
          runsConsumed: { increment: 1 },
          jobRunsConsumed: runKind === 'job' ? { increment: 1 } : undefined,
          scholarshipRunsConsumed: runKind === 'scholarship' ? { increment: 1 } : undefined,
          grantRunsConsumed: runKind === 'grant' ? { increment: 1 } : undefined,
          visaRunsConsumed: runKind === 'visa' ? { increment: 1 } : undefined,
        },
        create: {
          userId,
          usageDate,
          runsConsumed: 1,
          jobRunsConsumed: runKind === 'job' ? 1 : 0,
          scholarshipRunsConsumed: runKind === 'scholarship' ? 1 : 0,
          grantRunsConsumed: runKind === 'grant' ? 1 : 0,
          visaRunsConsumed: runKind === 'visa' ? 1 : 0,
        },
      })
      return {
        blocked: false,
        runsConsumed: next.runsConsumed,
      }
    })

    if (quota.blocked) {
      throw this.buildQuotaException(quota.runsConsumed)
    }

    return {
      consumed: true,
      usageDate,
    }
  }

  async releaseConsumedRunAllowance(userId: string, runKind: SearchRunKind, usageDate: Date) {
    if (!this.isEnforcementEnabled()) return

    const existing = await this.getUsageForDay(userId, usageDate)
    if (!existing || existing.runsConsumed <= 0) return

    await this.prisma.dailySearchUsage.update({
      where: {
        userId_usageDate: {
          userId,
          usageDate,
        },
      },
      data: {
        runsConsumed: Math.max(0, existing.runsConsumed - 1),
        jobRunsConsumed: runKind === 'job' ? Math.max(0, existing.jobRunsConsumed - 1) : existing.jobRunsConsumed,
        scholarshipRunsConsumed:
          runKind === 'scholarship'
            ? Math.max(0, existing.scholarshipRunsConsumed - 1)
            : existing.scholarshipRunsConsumed,
        grantRunsConsumed:
          runKind === 'grant' ? Math.max(0, existing.grantRunsConsumed - 1) : existing.grantRunsConsumed,
        visaRunsConsumed: runKind === 'visa' ? Math.max(0, existing.visaRunsConsumed - 1) : existing.visaRunsConsumed,
      },
    })
  }

  async getCurrentSubscription(userId: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: [{ currentPeriodEnd: 'desc' }, { updatedAt: 'desc' }],
      take: 10,
    })

    return subscriptions.find((item) => subscriptionHasAccess(item)) || subscriptions[0] || null
  }

  private async getUsageForDay(userId: string, usageDate: Date) {
    return await this.prisma.dailySearchUsage.findUnique({
      where: {
        userId_usageDate: {
          userId,
          usageDate,
        },
      },
    })
  }

  private buildQuotaException(used: number) {
    const dailyLimit = getFreeDailySearchLimit(this.config)
    throw new HttpException(
      {
        error: 'Daily search limit reached',
        code: 'daily_limit_reached',
        limit: dailyLimit,
        used: Math.max(dailyLimit, used),
        remaining: 0,
        resetAt: nextUtcResetAt().toISOString(),
        upgradeOptions: getConfiguredBillingPlans(this.config).map((plan) => ({
          planKey: plan.planKey,
          currency: plan.currency,
          provider: plan.provider,
          interval: plan.interval,
          amountMinor: plan.amountMinor,
          priceLabel: plan.priceLabel,
          label: plan.label,
        })),
      },
      HttpStatus.PAYMENT_REQUIRED,
    )
  }
}
