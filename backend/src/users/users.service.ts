import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export type UserSearchRunSummary = {
  totalSearchesRun: number
  jobsRun: number
  scholarshipsRun: number
  visasRun: number
}

export type AuthenticatedUserSummary = {
  userId: string
  email: string
  searchRunSummary: UserSearchRunSummary
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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

    const [totalSearchesRun, jobsRun, scholarshipsRun, visasRun] = await Promise.all([
      this.prisma.jobSearchRun.count({ where: { userId: user.id } }),
      this.prisma.jobSearchRun.count({ where: { userId: user.id, runKind: 'job' } }),
      this.prisma.jobSearchRun.count({ where: { userId: user.id, runKind: 'scholarship' } }),
      this.prisma.jobSearchRun.count({ where: { userId: user.id, runKind: 'visa' } }),
    ])

    return {
      userId: user.id,
      email: user.email,
      searchRunSummary: {
        totalSearchesRun,
        jobsRun,
        scholarshipsRun,
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
