import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { z } from 'zod'
import { JwtAuthGuard } from '../auth/jwt.guard'
import { PrismaService } from '../prisma/prisma.service'

const CreateDocumentSchema = z.object({
  type: z.enum(['cv', 'cover_letter', 'sop']),
  title: z.string().min(1),
  content: z.string().min(1),
  opportunityId: z.string().optional().nullable(),
})

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any) {
    const userId = req.user.userId as string
    const documents = await this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return { documents }
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    let data: z.infer<typeof CreateDocumentSchema>
    try {
      data = CreateDocumentSchema.parse(body || {})
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid input', details: e?.issues || e?.message })
    }

    const userId = req.user.userId as string
    if (data.opportunityId) {
      const op = await this.prisma.opportunity.findFirst({ where: { id: data.opportunityId, userId } })
      if (!op) throw new NotFoundException('Opportunity not found')
    }

    const document = await this.prisma.document.create({
      data: {
        userId,
        type: data.type,
        title: data.title,
        content: data.content,
        opportunityId: data.opportunityId ?? null,
      },
    })
    return { ok: true, document }
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.userId as string
    const existing = await this.prisma.document.findFirst({ where: { id, userId } })
    if (!existing) throw new NotFoundException('Document not found')
    await this.prisma.document.delete({ where: { id } })
    return { ok: true }
  }
}

