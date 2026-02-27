import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { JwtAuthGuard } from '../auth/jwt.guard'
import { runTinyfish, TinyfishRunRequest } from './tinyfish.client'

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

    const evt = await runTinyfish(parsed)
    return evt
  }
}

