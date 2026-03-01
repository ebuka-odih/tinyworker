import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common'
import { z } from 'zod'
import { JwtAuthGuard } from '../auth/jwt.guard'
import {
  getTinyfishRunById,
  runTinyfish,
  runTinyfishWithFallback,
  runTinyfishAsync,
  runTinyfishBatch,
  TinyfishRunRequest,
} from './tinyfish.client'

const TinyfishRunSchema = z.object({
  url: z.string().url(),
  goal: z.string().min(1),
  browser_profile: z.enum(['lite', 'stealth']).optional(),
  proxy_config: z
    .object({
      enabled: z.boolean(),
      country_code: z.string().optional(),
    })
    .optional(),
  feature_flags: z
    .object({
      enable_agent_memory: z.boolean().optional(),
    })
    .optional(),
  api_integration: z.string().optional(),
})

const TinyfishRunBatchSchema = z.object({
  runs: z.array(TinyfishRunSchema).min(1).max(20),
})

@Controller('tinyfish')
@UseGuards(JwtAuthGuard)
export class TinyfishController {
  @Post('run')
  async run(@Body() body: any) {
    let parsed: TinyfishRunRequest
    try {
      parsed = TinyfishRunSchema.parse(body)
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid input', details: e?.issues || e?.message })
    }

    try {
      const evt = await runTinyfishWithFallback(parsed)
      return evt
    } catch (e: any) {
      const details = e?.message || String(e)
      const missingKey = String(details).includes('Missing TinyFish API key')
      throw new ServiceUnavailableException({
        error: missingKey ? 'TinyFish API key is not configured on backend' : 'TinyFish is unavailable',
        details,
      })
    }
  }

  @Post('run-async')
  async runAsync(@Body() body: any) {
    let parsed: TinyfishRunRequest
    try {
      parsed = TinyfishRunSchema.parse(body)
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid input', details: e?.issues || e?.message })
    }

    try {
      return await runTinyfishAsync(parsed)
    } catch (e: any) {
      const details = e?.message || String(e)
      const missingKey = String(details).includes('Missing TinyFish API key')
      throw new ServiceUnavailableException({
        error: missingKey ? 'TinyFish API key is not configured on backend' : 'TinyFish is unavailable',
        details,
      })
    }
  }

  @Post('run-batch')
  async runBatch(@Body() body: any) {
    let parsed: { runs: TinyfishRunRequest[] }
    try {
      parsed = TinyfishRunBatchSchema.parse(body)
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid input', details: e?.issues || e?.message })
    }

    try {
      return await runTinyfishBatch(parsed.runs)
    } catch (e: any) {
      const details = e?.message || String(e)
      const missingKey = String(details).includes('Missing TinyFish API key')
      throw new ServiceUnavailableException({
        error: missingKey ? 'TinyFish API key is not configured on backend' : 'TinyFish is unavailable',
        details,
      })
    }
  }

  @Get('runs/:runId')
  async getRun(@Param('runId') runId: string) {
    const id = String(runId || '').trim()
    if (!id) throw new BadRequestException({ error: 'runId is required' })

    try {
      return await getTinyfishRunById(id)
    } catch (e: any) {
      const details = e?.message || String(e)
      const missingKey = String(details).includes('Missing TinyFish API key')
      throw new ServiceUnavailableException({
        error: missingKey ? 'TinyFish API key is not configured on backend' : 'TinyFish is unavailable',
        details,
      })
    }
  }
}
