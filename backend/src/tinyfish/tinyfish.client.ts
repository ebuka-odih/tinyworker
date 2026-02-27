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
}

const TINYFISH_RUN_SSE_URL =
  process.env.TINYFISH_RUN_SSE_URL || 'https://agent.tinyfish.ai/v1/automation/run-sse'

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

async function readSseUntilComplete(res: Response): Promise<TinyfishSseEvent> {
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lastEvent: TinyfishSseEvent | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    while (true) {
      const sepIdx = buffer.indexOf('\n\n')
      if (sepIdx === -1) break

      const rawEvent = buffer.slice(0, sepIdx)
      buffer = buffer.slice(sepIdx + 2)

      const lines = rawEvent.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice('data:'.length).trim()
        if (!data) continue
        try {
          const evt = JSON.parse(data)
          lastEvent = evt
          if (evt?.type === 'COMPLETE') return evt
        } catch {
          // ignore
        }
      }
    }
  }

  return lastEvent || { type: 'ERROR', error: 'Stream ended without COMPLETE' }
}

export async function runTinyfish(req: TinyfishRunRequest): Promise<TinyfishSseEvent> {
  const apiKey = requireTinyfishApiKey()

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
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`TinyFish HTTP ${resp.status}: ${text || resp.statusText}`)
  }

  return await readSseUntilComplete(resp)
}
