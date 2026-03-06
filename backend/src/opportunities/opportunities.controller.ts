import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { z } from 'zod'
import { JwtAuthGuard } from '../auth/jwt.guard'
import { PrismaService } from '../prisma/prisma.service'
import { JobSearchOrchestrator } from './job-search.orchestrator'
import { getActiveDiscoveryDomains } from './job-source-registry'
import { JobSearchRunStore, SearchRunEvent } from './job-search-run.store'
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
  maxNumResults: z.coerce.number().int().min(1).max(10).optional(),
  sourceScope: z.enum(['global', 'regional']).optional(),
  remote: z
    .union([z.boolean(), z.string().transform((value) => value === 'true')])
    .optional()
    .transform((value) => Boolean(value)),
  visaSponsorship: z
    .union([z.boolean(), z.string().transform((value) => value === 'true')])
    .optional()
    .transform((value) => Boolean(value)),
})

const StartSearchRunSchema = z.object({
  query: z.string().min(2),
  countryCode: z.string().trim().min(2).max(2).optional(),
  maxNumResults: z.coerce.number().int().min(1).max(10).optional(),
  sourceScope: z.enum(['global', 'regional']).optional(),
  remote: z.boolean().optional(),
  visaSponsorship: z.boolean().optional(),
})

@Controller('opportunities')
export class OpportunitiesController {
  constructor(
    private prisma: PrismaService,
    private valyuSearch: ValyuSearchService,
    private jobSearchOrchestrator: JobSearchOrchestrator,
    private runStore: JobSearchRunStore,
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
      includedSources: getActiveDiscoveryDomains(parsed.sourceScope || 'global'),
    })

    return { ok: true, results }
  }

  @Post('search/jobs/runs')
  async startSearchRun(@Body() body: any) {
    let parsed: z.infer<typeof StartSearchRunSchema>
    try {
      parsed = StartSearchRunSchema.parse(body || {})
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid search run input', details: e?.issues || e?.message })
    }

    const run = await this.jobSearchOrchestrator.startRun({
      query: parsed.query,
      countryCode: parsed.countryCode?.toUpperCase(),
      maxNumResults: parsed.maxNumResults ?? 10,
      sourceScope: parsed.sourceScope || 'global',
      remote: parsed.remote,
      visaSponsorship: parsed.visaSponsorship,
    })

    return { ok: true, ...run }
  }

  @Get('search/jobs/runs/:runId')
  async getSearchRunSnapshot(@Param('runId') runId: string) {
    const snapshot = await this.jobSearchOrchestrator.getSnapshot(runId)
    if (!snapshot) {
      throw new BadRequestException({ error: 'Search run not found' })
    }
    return { ok: true, snapshot }
  }

  @Post('search/jobs/runs/:runId/stop')
  async stopSearchRun(@Param('runId') runId: string) {
    const stopped = await this.jobSearchOrchestrator.stopRun(runId)
    const snapshot = await this.jobSearchOrchestrator.getSnapshot(runId)
    return { ok: true, stopped, snapshot }
  }

  @Get('search/jobs/runs/:runId/stream')
  async streamSearchRun(@Param('runId') runId: string, @Query('since') sinceRaw: string | undefined, @Req() req: any, @Res() res: Response) {
    const since = Number.isFinite(Number(sinceRaw)) ? Math.max(0, Number(sinceRaw)) : 0

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    ;(res as any).flushHeaders?.()

    const writeEvent = (event: SearchRunEvent) => {
      const payload = JSON.stringify(event)
      res.write(`id: ${event.sequence}\n`)
      res.write(`event: ${event.type}\n`)
      res.write(`data: ${payload}\n\n`)
    }

    const events = await this.jobSearchOrchestrator.getEventsSince(runId, since)
    for (const event of events) {
      writeEvent(event)
    }

    const unsubscribe = this.runStore.subscribe(runId, writeEvent)
    if (!unsubscribe) {
      const snapshot = await this.jobSearchOrchestrator.getSnapshot(runId)
      if (snapshot) {
        res.write(`event: snapshot\n`)
        res.write(`data: ${JSON.stringify(snapshot)}\n\n`)
      } else {
        res.write(`event: run_error\n`)
        res.write(`data: ${JSON.stringify({ message: 'Run not found' })}\n\n`)
      }
      res.end()
      return
    }

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n')
    }, 15_000)

    req.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
      res.end()
    })
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
