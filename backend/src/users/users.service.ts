import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { BillingService } from '../billing/billing.service'
import { SearchQuotaService, SearchQuotaSnapshot } from '../billing/search-quota.service'

export type UserSearchRunSummary = {
  totalSearchesRun: number
  jobsRun: number
  scholarshipsRun: number
  grantsRun: number
  visasRun: number
}

export type AuthenticatedUserSummary = {
  userId: string
  email: string
  subscriptionTier: 'free' | 'pro'
  billingStatus: string
  billingProvider: string | null
  billingInterval: string | null
  billingCurrency: string | null
  billingCurrentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  searchQuota: SearchQuotaSnapshot
  searchRunSummary: UserSearchRunSummary
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private billingService: BillingService,
    private searchQuotaService: SearchQuotaService,
  ) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } })
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  async getAuthenticatedUserSummary(userId: string): Promise<AuthenticatedUserSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
      },
    })
    if (!user) throw new NotFoundException('User not found')

    const [totalSearchesRun, jobsRun, scholarshipsRun, grantsRun, visasRun, billing, searchQuota] = await Promise.all([
      this.prisma.jobSearchRun.count({ where: { userId: user.id } }),
      this.prisma.jobSearchRun.count({ where: { userId: user.id, runKind: 'job' } }),
      this.prisma.jobSearchRun.count({ where: { userId: user.id, runKind: 'scholarship' } }),
      this.prisma.jobSearchRun.count({ where: { userId: user.id, runKind: 'grant' } }),
      this.prisma.jobSearchRun.count({ where: { userId: user.id, runKind: 'visa' } }),
      this.billingService.getBillingSnapshot(user.id),
      this.searchQuotaService.getQuotaSnapshot(user.id),
    ])

    return {
      userId: user.id,
      email: user.email,
      subscriptionTier: billing.subscriptionTier,
      billingStatus: billing.billingStatus,
      billingProvider: billing.provider,
      billingInterval: billing.interval,
      billingCurrency: billing.currency,
      billingCurrentPeriodEnd: billing.currentPeriodEnd,
      cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
      searchQuota,
      searchRunSummary: {
        totalSearchesRun,
        jobsRun,
        scholarshipsRun,
        grantsRun,
        visasRun,
      },
    }
  }

  async createUser(params: { email: string; passwordHash: string; displayName?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: params.email } })
    if (existing) throw new ConflictException('Email already in use')

    return this.prisma.user.create({
      data: {
        email: params.email,
        passwordHash: params.passwordHash,
        displayName: params.displayName,
      },
    })
  }
}
