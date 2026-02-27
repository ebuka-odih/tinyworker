import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { z } from 'zod'
import { PrismaService } from '../prisma/prisma.service'

const TelegramMessageSchema = z.object({
  message_id: z.number(),
  text: z.string().optional(),
  chat: z.object({
    id: z.union([z.number(), z.string()]),
    type: z.string(),
  }),
  from: z
    .object({
      id: z.union([z.number(), z.string()]),
      username: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
    })
    .optional(),
})

const TelegramUpdateSchema = z.object({
  update_id: z.number().optional(),
  message: TelegramMessageSchema.optional(),
  edited_message: TelegramMessageSchema.optional(),
})

type TelegramMessage = z.infer<typeof TelegramMessageSchema>

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name)

  constructor(private prisma: PrismaService) {}

  isWebhookAuthorized(secretHeader?: string, secretQuery?: string): boolean {
    const expected = String(process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim()
    if (!expected) return true

    const provided = String(secretHeader || secretQuery || '').trim()
    return provided.length > 0 && provided === expected
  }

  async handleUpdate(payload: unknown) {
    const parsed = TelegramUpdateSchema.safeParse(payload)
    if (!parsed.success) {
      this.logger.warn('Ignoring invalid Telegram webhook payload')
      return { ok: true, ignored: true, reason: 'invalid_payload' }
    }

    const message = parsed.data.message ?? parsed.data.edited_message
    if (!message?.text) {
      return { ok: true, ignored: true, reason: 'no_text_message' }
    }

    const chatId = String(message.chat.id)
    if (!this.isChatAllowed(chatId)) {
      this.logger.warn(`Ignoring Telegram message from non-allowed chat ${chatId}`)
      return { ok: true, ignored: true, reason: 'chat_not_allowed' }
    }

    const text = message.text.trim()
    if (!text) return { ok: true, ignored: true, reason: 'empty_text' }

    if (this.matchesCommand(text, 'start')) {
      await this.sendMessage(chatId, this.helpMessage())
      return { ok: true, handled: 'start' }
    }

    if (this.matchesCommand(text, 'tasks')) {
      await this.sendOpenTasksToChat(chatId)
      return { ok: true, handled: 'tasks' }
    }

    const doneIdPrefix = this.extractDoneTaskPrefix(text)
    if (doneIdPrefix) {
      const doneTask = await this.markTaskDoneByPrefix(chatId, doneIdPrefix)
      if (!doneTask) {
        await this.sendMessage(chatId, `No open task found for id prefix ${doneIdPrefix}.`)
        return { ok: true, handled: 'done_not_found' }
      }

      await this.sendMessage(chatId, `Marked task ${this.shortId(doneTask.id)} as done.`)
      return { ok: true, handled: 'done', taskId: doneTask.id }
    }

    const taskText = this.extractTaskText(text)
    if (!taskText) {
      if (text.startsWith('/')) {
        await this.sendMessage(chatId, `Unknown command.\n\n${this.helpMessage()}`)
        return { ok: true, handled: 'unknown_command' }
      }
      return { ok: true, ignored: true, reason: 'not_task' }
    }

    const task = await this.saveTaskFromMessage(chatId, message, taskText)
    await this.sendMessage(chatId, `Saved task ${this.shortId(task.id)}.`)

    return { ok: true, handled: 'task_saved', taskId: task.id }
  }

  async sendProjectUpdate(params: { message: string; chatId?: string; sentByUserId?: string }) {
    const chatId = params.chatId || this.defaultChatId()
    if (!chatId) {
      throw new ServiceUnavailableException(
        'Telegram target chat is not configured. Set TELEGRAM_DEFAULT_CHAT_ID or pass chatId in request body.',
      )
    }

    const sentMessage = await this.sendMessage(chatId, params.message)

    const report = await this.prisma.telegramReport.create({
      data: {
        chatId,
        message: params.message,
        sentByUserId: params.sentByUserId ?? null,
        telegramMessageId: sentMessage?.message_id ? String(sentMessage.message_id) : null,
      },
    })

    return { ok: true, report }
  }

  async listTasks(params: { chatId?: string; status?: 'open' | 'done'; limit?: number }) {
    const limit = Math.max(1, Math.min(params.limit ?? 20, 100))

    const tasks = await this.prisma.telegramTask.findMany({
      where: {
        ...(params.chatId ? { chatId: params.chatId } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return tasks
  }

  async updateTaskStatus(taskId: string, status: 'open' | 'done') {
    const existing = await this.prisma.telegramTask.findUnique({ where: { id: taskId } })
    if (!existing) throw new NotFoundException('Task not found')

    const task = await this.prisma.telegramTask.update({
      where: { id: taskId },
      data: {
        status,
        completedAt: status === 'done' ? new Date() : null,
      },
    })

    return task
  }

  private async sendOpenTasksToChat(chatId: string) {
    const tasks = await this.prisma.telegramTask.findMany({
      where: { chatId, status: 'open' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    if (!tasks.length) {
      await this.sendMessage(chatId, 'No open tasks.')
      return
    }

    const lines = tasks.map((task, idx) => `${idx + 1}. [${this.shortId(task.id)}] ${this.oneLine(task.text, 120)}`)
    const message = `Open tasks (${tasks.length}):\n${lines.join('\n')}\n\nUse /done <task-id-prefix> to complete.`
    await this.sendMessage(chatId, message)
  }

  private async markTaskDoneByPrefix(chatId: string, idPrefix: string) {
    const normalized = idPrefix.toLowerCase()

    const task = await this.prisma.telegramTask.findFirst({
      where: {
        chatId,
        status: 'open',
        id: { startsWith: normalized },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!task) return null

    return this.prisma.telegramTask.update({
      where: { id: task.id },
      data: {
        status: 'done',
        completedAt: new Date(),
      },
    })
  }

  private async saveTaskFromMessage(chatId: string, message: TelegramMessage, taskText: string) {
    const messageId = String(message.message_id)
    const fromId = message.from?.id ? String(message.from.id) : null
    const username = message.from?.username ?? null
    const nameParts = [message.from?.first_name, message.from?.last_name].filter(Boolean)
    const displayName = nameParts.length ? nameParts.join(' ') : username

    return this.prisma.telegramTask.upsert({
      where: {
        chatId_messageId: {
          chatId,
          messageId,
        },
      },
      update: {
        text: taskText,
        telegramUserId: fromId,
        telegramUsername: username,
        telegramDisplayName: displayName,
      },
      create: {
        chatId,
        messageId,
        text: taskText,
        telegramUserId: fromId,
        telegramUsername: username,
        telegramDisplayName: displayName,
        source: 'telegram',
      },
    })
  }

  private extractTaskText(text: string): string | null {
    const commandMatch = text.match(/^\/task(?:@\w+)?\s+([\s\S]+)/i)
    if (commandMatch?.[1]) return commandMatch[1].trim()

    const labeledTaskMatch = text.match(/^(?:task|todo)\s*:\s*([\s\S]+)/i)
    if (labeledTaskMatch?.[1]) return labeledTaskMatch[1].trim()

    if (text.startsWith('/')) return null

    return text
  }

  private extractDoneTaskPrefix(text: string): string | null {
    const match = text.match(/^\/done(?:@\w+)?\s+([a-zA-Z0-9-]{4,64})$/i)
    if (!match?.[1]) return null
    return match[1].trim().toLowerCase()
  }

  private matchesCommand(text: string, command: 'start' | 'tasks') {
    return new RegExp(`^/${command}(?:@\\w+)?$`, 'i').test(text)
  }

  private helpMessage() {
    return [
      'TinyWorker task bot commands:',
      '/task <text> - save a task',
      '/tasks - list open tasks',
      '/done <task-id-prefix> - mark task done',
      '',
      'Plain text messages are also stored as open tasks.',
    ].join('\n')
  }

  private shortId(id: string) {
    return id.slice(0, 8)
  }

  private oneLine(text: string, maxLen: number) {
    const normalized = text.replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxLen) return normalized
    return `${normalized.slice(0, Math.max(0, maxLen - 3))}...`
  }

  private defaultChatId() {
    const chatId = String(process.env.TELEGRAM_DEFAULT_CHAT_ID ?? '').trim()
    return chatId || null
  }

  private isChatAllowed(chatId: string) {
    const raw = String(process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '').trim()
    if (!raw) return true

    const allowed = new Set(
      raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    )

    return allowed.has(chatId)
  }

  private requireBotToken() {
    const token = String(process.env.TELEGRAM_BOT_TOKEN ?? '').trim()
    if (!token) {
      throw new ServiceUnavailableException('TELEGRAM_BOT_TOKEN is not configured')
    }
    return token
  }

  private async callTelegramApi<T>(method: string, body: Record<string, unknown>) {
    const token = this.requireBotToken()

    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean
      result?: T
      description?: string
    } | null

    if (!response.ok || !payload?.ok) {
      const details = payload?.description || response.statusText
      throw new ServiceUnavailableException(`Telegram API error (${method}): ${details}`)
    }

    return payload.result as T
  }

  async sendMessage(chatId: string, text: string) {
    return this.callTelegramApi<{ message_id?: number }>('sendMessage', {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    })
  }
}
