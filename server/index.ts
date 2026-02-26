import express from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

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

function requireApiKey(): string {
  const k = String(process.env.TINYFISH_API_KEY ?? '').trim()
  if (k) return k

  const mc = readApiKeyFromMissionControlSecrets()
  if (mc) return mc

  throw new Error(
    'Missing TinyFish API key. Set TINYFISH_API_KEY env var or configure it in Mission Control (/mc/settings → TinyFish).'
  )
}

async function readSseUntilComplete(res: Response): Promise<any> {
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lastEvent: any = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // SSE events are separated by \n\n; each event can contain multiple lines.
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

  return lastEvent || { type: 'ERROR', error: 'Stream ended without COMPLETE event' }
}

const app = express()
app.use(express.json({ limit: '1mb' }))

// Serve the built UI in production.
if (process.env.NODE_ENV === 'production') {
  const distDir = new URL('../dist', import.meta.url)
  app.use(express.static(distDir.pathname))
}

app.get('/healthz', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/tinyfish/run', async (req, res) => {
  try {
    const apiKey = requireApiKey()

    const body = req.body || {}
    if (!body.url || !body.goal) {
      return res.status(400).json({ error: 'Missing required fields: url, goal' })
    }

    const upstream = await fetch(TINYFISH_RUN_SSE_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      return res.status(upstream.status).send(text || upstream.statusText)
    }

    const finalEvt = await readSseUntilComplete(upstream)
    return res.json(finalEvt)
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' })
  }
})

// SPA fallback in production (must come after API routes).
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req, res) => {
    const indexPath = new URL('../dist/index.html', import.meta.url)
    res.sendFile(indexPath.pathname)
  })
}

const port = Number(process.env.PORT || 3010)
app.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`tinyfinder server listening on :${port}`)
})
