import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { z } from 'zod'
import { JwtAuthGuard } from '../auth/jwt.guard'
import { PrismaService } from '../prisma/prisma.service'

const CreateApplicationSchema = z.object({
  opportunityId: z.string().min(1),
  status: z
    .enum(['saved', 'preparing', 'ready', 'applied', 'interview', 'offer', 'rejected'])
    .optional(),
  notes: z.string().optional(),
})

const UpdateApplicationSchema = z.object({
  status: z.enum(['saved', 'preparing', 'ready', 'applied', 'interview', 'offer', 'rejected']).optional(),
  notes: z.string().optional().nullable(),
})

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any) {
    const userId = req.user.userId as string
    const applications = await this.prisma.application.findMany({
      where: { userId },
      include: { opportunity: true },
      orderBy: { updatedAt: 'desc' },
    })
    return { applications }
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    let data: z.infer<typeof CreateApplicationSchema>
    try {
      data = CreateApplicationSchema.parse(body || {})
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid input', details: e?.issues || e?.message })
    }

    const userId = req.user.userId as string
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id: data.opportunityId, userId },
    })
    if (!opportunity) throw new NotFoundException('Opportunity not found')

    const application = await this.prisma.application.create({
      data: {
        userId,
        opportunityId: data.opportunityId,
        status: data.status ?? 'saved',
        notes: data.notes ?? null,
      },
      include: { opportunity: true },
    })

    return { ok: true, application }
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    let data: z.infer<typeof UpdateApplicationSchema>
    try {
      data = UpdateApplicationSchema.parse(body || {})
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid input', details: e?.issues || e?.message })
    }

    const userId = req.user.userId as string
    const existing = await this.prisma.application.findFirst({ where: { id, userId } })
    if (!existing) throw new NotFoundException('Application not found')

    const application = await this.prisma.application.update({
      where: { id },
      data: {
        status: data.status ?? undefined,
        notes: data.notes ?? undefined,
      },
      include: { opportunity: true },
    })
    return { ok: true, application }
  }
}

