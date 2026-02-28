import { BadRequestException, Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { JwtAuthGuard } from '../auth/jwt.guard'
import { PrismaService } from '../prisma/prisma.service'

const WorkModeSchema = z.enum(['remote', 'hybrid', 'onsite'])

const UpdateIntentSchema = z
  .object({
    goal: z.enum(['job', 'scholarship', 'visa', 'mixed']).optional().nullable(),
    targetRoles: z.array(z.string().min(1)).optional(),
    targetLocations: z.array(z.string().min(1)).optional(),
    workModes: z.array(WorkModeSchema).optional(),
    industries: z.array(z.string().min(1)).optional(),
    salaryCurrency: z.string().min(1).optional().nullable(),
    salaryMin: z.number().int().nonnegative().optional().nullable(),
    salaryMax: z.number().int().nonnegative().optional().nullable(),
    startTimeline: z.string().min(1).optional().nullable(),
    visaRequired: z.boolean().optional().nullable(),
    constraints: z.array(z.string().min(1)).optional(),
    notes: z.string().max(4000).optional().nullable(),
    status: z.enum(['draft', 'ready']).optional(),
  })
  .refine(
    (data) =>
      data.salaryMin === undefined ||
      data.salaryMax === undefined ||
      data.salaryMin === null ||
      data.salaryMax === null ||
      data.salaryMax >= data.salaryMin,
    { message: 'salaryMax must be greater than or equal to salaryMin', path: ['salaryMax'] },
  )

function normalizeStringArray(value: string[] | undefined): string[] | undefined {
  if (!value) return undefined
  const normalized = value
    .map((v) => v.trim())
    .filter(Boolean)
  return normalized
}

@Controller('intent')
@UseGuards(JwtAuthGuard)
export class IntentController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getLatest(@Req() req: { user: { userId: string } }) {
    const userId = req.user.userId
    const intent = await this.prisma.candidateIntent.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })
    return { intent }
  }

  @Patch()
  async upsertLatest(@Req() req: { user: { userId: string } }, @Body() body: unknown) {
    let data: z.infer<typeof UpdateIntentSchema>
    try {
      data = UpdateIntentSchema.parse(body || {})
    } catch (e: unknown) {
      const details = typeof e === 'object' && e && 'issues' in e ? (e as { issues: unknown }).issues : String(e)
      throw new BadRequestException({ error: 'Invalid input', details })
    }

    const userId = req.user.userId
    const latest = await this.prisma.candidateIntent.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })

    const payload = {
      goal: data.goal ?? undefined,
      targetRoles: normalizeStringArray(data.targetRoles) ?? undefined,
      targetLocations: normalizeStringArray(data.targetLocations) ?? undefined,
      workModes: data.workModes ?? undefined,
      industries: normalizeStringArray(data.industries) ?? undefined,
      salaryCurrency: data.salaryCurrency === null ? null : data.salaryCurrency ?? undefined,
      salaryMin: data.salaryMin === null ? null : data.salaryMin ?? undefined,
      salaryMax: data.salaryMax === null ? null : data.salaryMax ?? undefined,
      startTimeline: data.startTimeline === null ? null : data.startTimeline ?? undefined,
      visaRequired: data.visaRequired === null ? null : data.visaRequired ?? undefined,
      constraints: normalizeStringArray(data.constraints) ?? undefined,
      notes: data.notes === null ? null : data.notes ?? undefined,
      status: data.status ?? undefined,
    }

    const intent = latest
      ? await this.prisma.candidateIntent.update({
          where: { id: latest.id },
          data: payload,
        })
      : await this.prisma.candidateIntent.create({
          data: {
            userId,
            ...payload,
          },
        })

    return { ok: true, intent }
  }
}
