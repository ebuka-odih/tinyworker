import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { JwtAuthGuard } from '../auth/jwt.guard'
import { PrismaService } from '../prisma/prisma.service'
import { ValyuSearchService } from './valyu-search.service'

const OpportunityInputSchema = z.object({
  type: z.enum(['job', 'scholarship', 'visa']),
  title: z.string().min(1),
  organization: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  requirements: z.array(z.string()).optional(),
  link: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  matchScore: z.number().optional().nullable(),
  source: z.string().optional(),
})

const ImportSchema = z.object({
  items: z.array(OpportunityInputSchema).min(1),
})

const SearchJobsQuerySchema = z.object({
  query: z.string().min(2),
  countryCode: z.string().trim().min(2).max(2).optional(),
  maxNumResults: z.coerce.number().int().min(1).max(20).optional(),
})

@Controller('opportunities')
export class OpportunitiesController {
  constructor(
    private prisma: PrismaService,
    private valyuSearch: ValyuSearchService,
  ) {}

  @Get('search/jobs')
  async searchJobs(@Query() query: any) {
    let parsed: z.infer<typeof SearchJobsQuerySchema>
    try {
      parsed = SearchJobsQuerySchema.parse(query || {})
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid search query', details: e?.issues || e?.message })
    }

    const results = await this.valyuSearch.searchJobs({
      query: parsed.query,
      countryCode: parsed.countryCode?.toUpperCase(),
      maxNumResults: parsed.maxNumResults ?? 10,
    })

    return { ok: true, results }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: any, @Query('type') type?: string) {
    const userId = req.user.userId as string
    const opportunities = await this.prisma.opportunity.findMany({
      where: {
        userId,
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    return { opportunities }
  }

  @Post('import')
  @UseGuards(JwtAuthGuard)
  async import(@Req() req: any, @Body() body: any) {
    const userId = req.user.userId as string
    let parsed: z.infer<typeof ImportSchema>
    try {
      parsed = ImportSchema.parse(body || {})
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid input', details: e?.issues || e?.message })
    }

    const created = await this.prisma.$transaction(
      parsed.items.map((it) =>
        this.prisma.opportunity.create({
          data: {
            userId,
            type: it.type,
            title: it.title,
            organization: it.organization ?? null,
            location: it.location ?? null,
            description: it.description ?? null,
            requirements: it.requirements ?? undefined,
            link: it.link ?? null,
            deadline: it.deadline ?? null,
            matchScore: it.matchScore ?? null,
            source: it.source ?? 'tinyfish',
          },
        }),
      ),
    )

    return { ok: true, opportunities: created }
  }
}
