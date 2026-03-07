import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { z } from 'zod'
import { JwtAuthGuard } from '../auth/jwt.guard'
import { PrismaService } from '../prisma/prisma.service'
import { JobSearchOrchestrator } from './job-search.orchestrator'
import { getActiveDiscoveryDomains } from './job-source-registry'
import { JobSearchRunStore, SearchRunEvent } from './job-search-run.store'
import { ScholarshipSearchOrchestrator } from './scholarship-search.orchestrator'
import { getActiveScholarshipDiscoveryDomains } from './scholarship-source-registry'
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
  mode: z.enum(['classic', 'curated']).optional(),
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
  mode: z.enum(['classic', 'curated']).optional(),
  remote: z.boolean().optional(),
  visaSponsorship: z.boolean().optional(),
})

const ScholarshipSearchQuerySchema = z.object({
  query: z.string().min(2),
  maxNumResults: z.coerce.number().int().min(1).max(10).optional(),
  sourceScope: z.enum(['global', 'regional']).optional(),
})

@Controller('opportunities')
@UseGuards(JwtAuthGuard)
export class OpportunitiesController {
  constructor(
    private prisma: PrismaService,
    private valyuSearch: ValyuSearchService,
    private jobSearchOrchestrator: JobSearchOrchestrator,
    private scholarshipSearchOrchestrator: ScholarshipSearchOrchestrator,
    private runStore: JobSearchRunStore,
  ) {}

  @Get('search/jobs')
  async searchJobs(@Req() req: any, @Query() query: any) {
    let parsed: z.infer<typeof SearchJobsQuerySchema>
    try {
      parsed = SearchJobsQuerySchema.parse(query || {})
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid search query', details: e?.issues || e?.message })
    }

    const cacheHit = await this.jobSearchOrchestrator.getCachedSearchResults({
      userId: req.user.userId as string,
      query: parsed.query,
      countryCode: parsed.countryCode?.toUpperCase(),
      maxNumResults: parsed.maxNumResults ?? 10,
      sourceScope: parsed.sourceScope || 'global',
      mode: parsed.mode,
      remote: parsed.remote,
      visaSponsorship: parsed.visaSponsorship,
    })
    if (cacheHit) {
      return { ok: true, results: cacheHit.results, cache: cacheHit.cache }
    }

    const results = await this.valyuSearch.searchJobs({
      query: parsed.query,
      countryCode: parsed.countryCode?.toUpperCase(),
      maxNumResults: parsed.maxNumResults ?? 10,
      mode: parsed.mode,
      includedSources: getActiveDiscoveryDomains(parsed.sourceScope || 'global', parsed.mode || 'classic'),
    })

    return { ok: true, results }
  }

  @Post('search/jobs/runs')
  async startSearchRun(@Req() req: any, @Body() body: any) {
    let parsed: z.infer<typeof StartSearchRunSchema>
    try {
      parsed = StartSearchRunSchema.parse(body || {})
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid search run input', details: e?.issues || e?.message })
    }

    const run = await this.jobSearchOrchestrator.startRun({
      userId: req.user.userId as string,
      query: parsed.query,
      countryCode: parsed.countryCode?.toUpperCase(),
      maxNumResults: parsed.maxNumResults ?? 10,
      sourceScope: parsed.sourceScope || 'global',
      mode: parsed.mode,
      remote: parsed.remote,
      visaSponsorship: parsed.visaSponsorship,
    })

    return { ok: true, ...run }
  }

  @Get('search/scholarships')
  async searchScholarships(@Query() query: any) {
    let parsed: z.infer<typeof ScholarshipSearchQuerySchema>
    try {
      parsed = ScholarshipSearchQuerySchema.parse(query || {})
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid scholarship search query', details: e?.issues || e?.message })
    }

    const results = await this.valyuSearch.discoverScholarshipCandidates({
      query: parsed.query,
      maxNumResults: parsed.maxNumResults ?? 10,
      includedSources: getActiveScholarshipDiscoveryDomains(parsed.sourceScope || 'global'),
    })

    return {
      ok: true,
      results: results.map((item) => ({
        id: item.id,
        opportunityType: 'scholarship',
        title: item.title,
        organization: item.sourceName,
        location: 'Global',
        fitScore: item.relevance >= 0.8 ? 'High' : item.relevance >= 0.6 ? 'Medium' : 'Low',
        tags: [item.sourceName, 'Scholarship'],
        link: item.url,
        status: 'new',
        snippet: item.snippet,
        relevance: item.relevance,
        sourceName: item.sourceName,
        sourceDomain: item.sourceDomain,
        sourceType: item.sourceType,
        sourceVerified: item.sourceVerified,
        queueStatus: 'ready',
      })),
    }
  }

  @Post('search/scholarships/runs')
  async startScholarshipSearchRun(@Req() req: any, @Body() body: any) {
    let parsed: z.infer<typeof ScholarshipSearchQuerySchema>
    try {
      parsed = ScholarshipSearchQuerySchema.parse(body || {})
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid scholarship run input', details: e?.issues || e?.message })
    }

    const run = await this.scholarshipSearchOrchestrator.startRun({
      userId: req.user.userId as string,
      query: parsed.query,
      maxNumResults: parsed.maxNumResults ?? 10,
      sourceScope: parsed.sourceScope || 'global',
    })

    return { ok: true, ...run }
  }

  @Get('search/scholarships/runs/:runId')
  async getScholarshipSearchRunSnapshot(@Req() req: any, @Param('runId') runId: string) {
    const snapshot = await this.scholarshipSearchOrchestrator.getSnapshot(runId, req.user.userId as string)
    if (!snapshot) {
      throw new NotFoundException({ error: 'Scholarship search run not found' })
    }
    return { ok: true, snapshot }
  }

  @Post('search/scholarships/runs/:runId/stop')
  async stopScholarshipSearchRun(@Req() req: any, @Param('runId') runId: string) {
    const userId = req.user.userId as string
    const stopped = await this.scholarshipSearchOrchestrator.stopRun(runId, userId)
    const snapshot = await this.scholarshipSearchOrchestrator.getSnapshot(runId, userId)
    return { ok: true, stopped, snapshot }
  }

  @Get('search/scholarships/runs/:runId/stream')
  async streamScholarshipSearchRun(
    @Param('runId') runId: string,
    @Query('since') sinceRaw: string | undefined,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const since = Number.isFinite(Number(sinceRaw)) ? Math.max(0, Number(sinceRaw)) : 0
    const userId = req.user.userId as string

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

    const events = await this.scholarshipSearchOrchestrator.getEventsSince(runId, userId, since)
    for (const event of events) {
      writeEvent(event)
    }

    const unsubscribe = this.runStore.subscribe(runId, userId, writeEvent)
    if (!unsubscribe) {
      const snapshot = await this.scholarshipSearchOrchestrator.getSnapshot(runId, userId)
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

  @Get('search/jobs/runs/:runId')
  async getSearchRunSnapshot(@Req() req: any, @Param('runId') runId: string) {
    const snapshot = await this.jobSearchOrchestrator.getSnapshot(runId, req.user.userId as string)
    if (!snapshot) {
      throw new NotFoundException({ error: 'Search run not found' })
    }
    return { ok: true, snapshot }
  }

  @Post('search/jobs/runs/:runId/stop')
  async stopSearchRun(@Req() req: any, @Param('runId') runId: string) {
    const userId = req.user.userId as string
    const stopped = await this.jobSearchOrchestrator.stopRun(runId, userId)
    const snapshot = await this.jobSearchOrchestrator.getSnapshot(runId, userId)
    return { ok: true, stopped, snapshot }
  }

  @Get('search/jobs/runs/:runId/stream')
  async streamSearchRun(@Param('runId') runId: string, @Query('since') sinceRaw: string | undefined, @Req() req: any, @Res() res: Response) {
    const since = Number.isFinite(Number(sinceRaw)) ? Math.max(0, Number(sinceRaw)) : 0
    const userId = req.user.userId as string

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

    const events = await this.jobSearchOrchestrator.getEventsSince(runId, userId, since)
    for (const event of events) {
      writeEvent(event)
    }

    const unsubscribe = this.runStore.subscribe(runId, userId, writeEvent)
    if (!unsubscribe) {
      const snapshot = await this.jobSearchOrchestrator.getSnapshot(runId, userId)
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
  async import(@Req() req: any, @Body() body: any) {
    const userId = req.user.userId as string
    let parsed: z.infer<typeof ImportSchema>
    try {
      parsed = ImportSchema.parse(body || {})
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid input', details: e?.issues || e?.message })
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const saved = []

      for (const it of parsed.items) {
        const normalizedLink = String(it.link || '').trim() || null
        const existing = await tx.opportunity.findFirst({
          where: normalizedLink
            ? {
                userId,
                type: it.type,
                link: normalizedLink,
              }
            : {
                userId,
                type: it.type,
                title: it.title,
                organization: it.organization ?? null,
                location: it.location ?? null,
              },
        })

        if (existing) {
          saved.push(
            await tx.opportunity.update({
              where: { id: existing.id },
              data: {
                organization: it.organization ?? existing.organization,
                location: it.location ?? existing.location,
                description: it.description ?? existing.description,
                requirements: it.requirements ?? existing.requirements ?? undefined,
                link: normalizedLink ?? existing.link,
                deadline: it.deadline ?? existing.deadline,
                matchScore: it.matchScore ?? existing.matchScore,
                source: it.source ?? existing.source,
              },
            }),
          )
          continue
        }

        saved.push(
          await tx.opportunity.create({
            data: {
              userId,
              type: it.type,
              title: it.title,
              organization: it.organization ?? null,
              location: it.location ?? null,
              description: it.description ?? null,
              requirements: it.requirements ?? undefined,
              link: normalizedLink,
              deadline: it.deadline ?? null,
              matchScore: it.matchScore ?? null,
              source: it.source ?? 'tinyfish',
            },
          }),
        )
      }

      return saved
    })

    return { ok: true, opportunities: created }
  }
}
