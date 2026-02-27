import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { z } from 'zod'
import { JwtAuthGuard } from '../auth/jwt.guard'
import { TelegramService } from './telegram.service'

const SendReportSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  chatId: z.string().trim().min(1).optional(),
})

const TaskQuerySchema = z.object({
  chatId: z.string().trim().min(1).optional(),
  status: z.enum(['open', 'done']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

const UpdateTaskSchema = z.object({
  status: z.enum(['open', 'done']),
})

@Controller('telegram')
export class TelegramController {
  constructor(private telegram: TelegramService) {}

  @Post('webhook')
  async webhook(
    @Body() body: unknown,
    @Headers('x-telegram-bot-api-secret-token') secretHeader?: string,
    @Query('secret') secretQuery?: string,
  ) {
    if (!this.telegram.isWebhookAuthorized(secretHeader, secretQuery)) {
      throw new UnauthorizedException('Invalid Telegram webhook secret')
    }

    return this.telegram.handleUpdate(body)
  }

  @UseGuards(JwtAuthGuard)
  @Post('report')
  async sendReport(@Req() req: any, @Body() body: unknown) {
    let data: z.infer<typeof SendReportSchema>
    try {
      data = SendReportSchema.parse(body)
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid input', details: e?.issues || e?.message })
    }

    return this.telegram.sendProjectUpdate({
      message: data.message,
      chatId: data.chatId,
      sentByUserId: req.user.userId as string,
    })
  }

  @UseGuards(JwtAuthGuard)
  @Get('tasks')
  async listTasks(@Query() query: Record<string, string | undefined>) {
    let parsed: z.infer<typeof TaskQuerySchema>
    try {
      parsed = TaskQuerySchema.parse(query || {})
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid query', details: e?.issues || e?.message })
    }

    const tasks = await this.telegram.listTasks(parsed)
    return { tasks }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('tasks/:id')
  async updateTask(@Param('id') id: string, @Body() body: unknown) {
    let parsed: z.infer<typeof UpdateTaskSchema>
    try {
      parsed = UpdateTaskSchema.parse(body)
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid input', details: e?.issues || e?.message })
    }

    const task = await this.telegram.updateTaskStatus(id, parsed.status)
    return { ok: true, task }
  }
}
