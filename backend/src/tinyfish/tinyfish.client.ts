import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

export type TinyfishRunRequest = {
  url: string
  goal: string
  browser_profile?: 'lite' | 'stealth'
  proxy_config?: { enabled: boolean; country_code?: string }
  feature_flags?: { enable_agent_memory?: boolean }
  api_integration?: string
}

export type TinyfishSseEvent = {
  type: string
  status?: string
  error?: string
  resultJson?: any
  result?: any
  data?: any
}

export type TinyfishAsyncRunResponse = {
  run_id: string | null
  error?: any
}

export type TinyfishBatchRunResponse = {
  run_ids: string[] | null
  error?: any
}

export type TinyfishRunStatusResponse = {
  run_id: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | string
  goal?: string
  created_at?: string
  started_at?: string | null
  finished_at?: string | null
  result?: any
  error?: any
  streaming_url?: string | null
  browser_config?: any
}

const TINYFISH_RUN_SSE_URL =
  process.env.TINYFISH_RUN_SSE_URL || 'https://agent.tinyfish.ai/v1/automation/run-sse'
const TINYFISH_RUN_ASYNC_URL =
  process.env.TINYFISH_RUN_ASYNC_URL || 'https://agent.tinyfish.ai/v1/automation/run-async'
const TINYFISH_RUN_BATCH_URL =
  process.env.TINYFISH_RUN_BATCH_URL || 'https://agent.tinyfish.ai/v1/automation/run-batch'
const TINYFISH_RUNS_BASE_URL = process.env.TINYFISH_RUNS_BASE_URL || 'https://agent.tinyfish.ai/v1/runs'
const TINYFISH_SSE_TIMEOUT_MS = Number(process.env.TINYFISH_SSE_TIMEOUT_MS || 1000 * 60 * 6)
const TINYFISH_HTTP_TIMEOUT_MS = Number(process.env.TINYFISH_HTTP_TIMEOUT_MS || 1000 * 60)
const TINYFISH_ASYNC_FALLBACK_TIMEOUT_MS = Number(
  process.env.TINYFISH_ASYNC_FALLBACK_TIMEOUT_MS || 1000 * 60 * 12,
)
const TINYFISH_POLL_SHORT_MS = 2500
const TINYFISH_POLL_MEDIUM_MS = 7500
const TINYFISH_POLL_LONG_MS = 30000

function readApiKeyFromMissionControlSecrets(): string | null {
  try {
    const p = path.join(os.homedir(), '.openclaw', 'secrets', 'mission-control.secrets.json')
    const raw = fs.readFileSync(p, 'utf8')
    const j = JSON.parse(raw)
    const k = String(j?.tinyfish?.apiKey ?? '').trim()
    return k || null
  } catch {
    return null
  }
}

export function requireTinyfishApiKey(): string {
  const k = String(process.env.TINYFISH_API_KEY ?? '').trim()
  if (k) return k
  const mc = readApiKeyFromMissionControlSecrets()
  if (mc) return mc
  throw new Error('Missing TinyFish API key (env TINYFISH_API_KEY or Mission Control secrets store)')
}

async function requestTinyfishJson<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TINYFISH_HTTP_TIMEOUT_MS)

  try {
    const resp = await fetch(url, {
      ...init,
      signal: controller.signal,
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`TinyFish HTTP ${resp.status}: ${text || resp.statusText}`)
    }

    return (await resp.json()) as T
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(`TinyFish request timed out after ${Math.round(TINYFISH_HTTP_TIMEOUT_MS / 1000)}s`)
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}

async function readSseUntilComplete(res: Response): Promise<TinyfishSseEvent> {
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lastEvent: TinyfishSseEvent | null = null

  const isTerminal = (evt: TinyfishSseEvent | null | undefined) => {
    if (!evt || typeof evt !== 'object') return false
    const type = String(evt.type || '').toUpperCase()
    const status = String(evt.status || '').toUpperCase()
    if (type === 'COMPLETE') return true
    return status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED'
  }

  const normalizeEvent = (evt: any): TinyfishSseEvent => {
    if (!evt || typeof evt !== 'object') return { type: 'UNKNOWN' }
    const data = evt.data && typeof evt.data === 'object' ? evt.data : null
    return {
      ...evt,
      resultJson:
        evt.resultJson ??
        evt.result_json ??
        data?.resultJson ??
        data?.result_json ??
        (evt.status === 'COMPLETED' ? evt.result : undefined),
      result: evt.result ?? data?.result,
      error: evt.error ?? data?.error,
      status: evt.status ?? data?.status,
      type: evt.type ?? data?.type ?? 'UNKNOWN',
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    // Some SSE servers use CRLF. Normalize framing so separator detection works reliably.
    buffer = buffer.replace(/\r/g, '')

    while (true) {
      const sepIdx = buffer.indexOf('\n\n')
      if (sepIdx === -1) break

      const rawEvent = buffer.slice(0, sepIdx)
      buffer = buffer.slice(sepIdx + 2)

      const lines = rawEvent.split('\n')
      const dataLines: string[] = []
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        dataLines.push(trimmed.slice('data:'.length).trim())
      }

      if (!dataLines.length) continue
      const payload = dataLines.join('\n').trim()
      if (!payload) continue
      if (payload === '[DONE]') {
        if (lastEvent) return lastEvent
        return { type: 'COMPLETE', status: 'COMPLETED' }
      }

      try {
        const evt = normalizeEvent(JSON.parse(payload))
        lastEvent = evt
        if (isTerminal(evt)) return evt
      } catch {
        // ignore malformed event payloads and continue reading stream
      }
    }
  }

  // Some proxies close the stream without a trailing blank line.
  // Parse any remaining buffered payload as a final event frame.
  const tail = buffer.trim()
  if (tail) {
    const lines = tail.split('\n')
    const dataLines: string[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      dataLines.push(trimmed.slice('data:'.length).trim())
    }
    if (dataLines.length) {
      const payload = dataLines.join('\n').trim()
      if (payload && payload !== '[DONE]') {
        try {
          const evt = normalizeEvent(JSON.parse(payload))
          lastEvent = evt
          if (isTerminal(evt)) return evt
        } catch {
          // ignore malformed trailing payload
        }
      }
    }
  }

  return lastEvent || { type: 'ERROR', error: 'Stream ended without terminal event' }
}

export async function runTinyfish(req: TinyfishRunRequest): Promise<TinyfishSseEvent> {
  const apiKey = requireTinyfishApiKey()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TINYFISH_SSE_TIMEOUT_MS)

  try {
    const resp = await fetch(TINYFISH_RUN_SSE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        browser_profile: 'stealth',
        proxy_config: { enabled: false },
        feature_flags: { enable_agent_memory: false },
        api_integration: 'tinyfinder-api',
        ...req,
      }),
      signal: controller.signal,
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`TinyFish HTTP ${resp.status}: ${text || resp.statusText}`)
    }

    return await readSseUntilComplete(resp)
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(`TinyFish timed out after ${Math.round(TINYFISH_SSE_TIMEOUT_MS / 1000)}s`)
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}

export async function runTinyfishAsync(req: TinyfishRunRequest): Promise<TinyfishAsyncRunResponse> {
  const apiKey = requireTinyfishApiKey()
  return await requestTinyfishJson<TinyfishAsyncRunResponse>(TINYFISH_RUN_ASYNC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      browser_profile: 'stealth',
      proxy_config: { enabled: false },
      feature_flags: { enable_agent_memory: false },
      api_integration: 'tinyfinder-api',
      ...req,
    }),
  })
}

export async function runTinyfishBatch(runs: TinyfishRunRequest[]): Promise<TinyfishBatchRunResponse> {
  const apiKey = requireTinyfishApiKey()
  return await requestTinyfishJson<TinyfishBatchRunResponse>(TINYFISH_RUN_BATCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      runs: runs.map((req) => ({
        browser_profile: 'stealth',
        proxy_config: { enabled: false },
        feature_flags: { enable_agent_memory: false },
        api_integration: 'tinyfinder-api',
        ...req,
      })),
    }),
  })
}

export async function getTinyfishRunById(runId: string): Promise<TinyfishRunStatusResponse> {
  const apiKey = requireTinyfishApiKey()
  const safeId = encodeURIComponent(String(runId || '').trim())
  return await requestTinyfishJson<TinyfishRunStatusResponse>(`${TINYFISH_RUNS_BASE_URL}/${safeId}`, {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
      Accept: 'application/json',
    },
  })
}

function pollingIntervalForElapsed(elapsedMs: number): number {
  if (elapsedMs < 60_000) return TINYFISH_POLL_SHORT_MS
  if (elapsedMs < 5 * 60_000) return TINYFISH_POLL_MEDIUM_MS
  return TINYFISH_POLL_LONG_MS
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function extractRunPayload(run: TinyfishRunStatusResponse | null | undefined): any {
  const anyRun = run as any
  if (!anyRun || typeof anyRun !== 'object') return null
  return (
    anyRun?.result ??
    anyRun?.result_json ??
    anyRun?.resultJson ??
    anyRun?.data?.result ??
    anyRun?.data?.result_json ??
    anyRun?.data?.resultJson ??
    null
  )
}

export async function waitForTinyfishRunCompletion(runId: string): Promise<TinyfishRunStatusResponse> {
  const startedAt = Date.now()
  let completedWithoutPayloadCount = 0

  while (true) {
    const run = await getTinyfishRunById(runId)
    const status = String(run.status || '').toUpperCase()

    if (status === 'COMPLETED') {
      const payload = extractRunPayload(run)
      if (payload != null) return run
      completedWithoutPayloadCount += 1
      if (completedWithoutPayloadCount >= 6) return run
    }

    if (status === 'FAILED' || status === 'CANCELLED') return run

    const elapsed = Date.now() - startedAt
    if (elapsed >= TINYFISH_ASYNC_FALLBACK_TIMEOUT_MS) {
      throw new Error(
        `TinyFish async fallback timed out after ${Math.round(TINYFISH_ASYNC_FALLBACK_TIMEOUT_MS / 1000)}s`,
      )
    }

    await wait(pollingIntervalForElapsed(elapsed))
  }
}

export async function runTinyfishWithFallback(req: TinyfishRunRequest): Promise<TinyfishSseEvent> {
  try {
    return await runTinyfish(req)
  } catch (primaryErr: any) {
    const primaryDetails = primaryErr?.message || String(primaryErr || 'Unknown TinyFish SSE error')

    const asyncStart = await runTinyfishAsync(req)
    const runId = String(asyncStart?.run_id || '').trim()
    if (!runId) {
      throw new Error(`TinyFish SSE failed and async fallback did not return run_id. SSE details: ${primaryDetails}`)
    }

    const run = await waitForTinyfishRunCompletion(runId)
    const status = String(run.status || '').toUpperCase()
    if (status === 'COMPLETED') {
      return {
        type: 'COMPLETE',
        status: 'COMPLETED',
        resultJson: extractRunPayload(run),
      }
    }

    const reason = (run as any)?.error?.message || (run as any)?.error?.details || `status=${run.status}`
    throw new Error(`TinyFish SSE failed (${primaryDetails}); async fallback run ${runId} ended with ${reason}`)
  }
}
