import {
  TinyfishAsyncRunResponse,
  TinyfishBatchRunResponse,
  TinyfishRunRequest,
  TinyfishRunStatusResponse,
  TinyfishSseEvent,
  Opportunity,
} from '../types'

type JobSearchCriteria = Record<string, string>
type ConfidenceLevel = 'high' | 'medium' | 'low'

const DEFAULT_JOB_RESULTS_LIMIT = 10
const DEFAULT_JOB_SOURCES =
  'LinkedIn Jobs, Indeed, Jobberman, MyJobMag, Djinni (Tech Jobs), Company Career Pages'
const TINYFISH_PROXY_TIMEOUT_MS = 1000 * 60 * 7
const MULTI_SOURCE_RUN_TIMEOUT_MS = 1000 * 60 * 12
const SHORT_TASK_POLL_MS = 2500
const MEDIUM_TASK_POLL_MS = 7500
const LONG_TASK_POLL_MS = 30000

function tinyfishApiBase(): string {
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('vercel.app')) {
    return '/api/tinyfish'
  }
  // Default to same-origin API path (works with frontend rewrite/proxy, avoids CORS).
  // Use explicit env override only when you intentionally want cross-origin direct backend calls.
  const directFromEnv =
    typeof import.meta !== 'undefined' ? String((import.meta as any).env?.VITE_TINYFISH_BACKEND_URL || '').trim() : ''
  if (directFromEnv) {
    return `${directFromEnv.replace(/\/+$/, '')}/api/tinyfish`
  }
  return '/api/tinyfish'
}

function tinyfishRunEndpoint(): string {
  return `${tinyfishApiBase()}/run`
}

function tinyfishRunBatchEndpoint(): string {
  return `${tinyfishApiBase()}/run-batch`
}

function tinyfishRunAsyncEndpoint(): string {
  return `${tinyfishApiBase()}/run-async`
}

function tinyfishRunByIdEndpoint(runId: string): string {
  return `${tinyfishApiBase()}/runs/${encodeURIComponent(runId)}`
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
    const numeric = Number(value.replace(/[^\d.-]/g, ''))
    if (Number.isFinite(numeric)) return numeric
  }
  return undefined
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function normalizeToken(value: unknown): string {
  return asText(value).toLowerCase()
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => asText(item))
      .filter(Boolean)
      .slice(0, 12)
  }
  const text = asText(value)
  if (!text) return []
  return text
    .split(/\n|;|\||•|,/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 12)
}

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const key = item.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      out.push(item)
    }
  }
  return out
}

function tryParseJson(value: string): unknown {
  const text = value.trim()
  if (!text || (!text.includes('{') && !text.includes('['))) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function looksLikeJobRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  const hasTitle = Boolean(row.title || row.job_title || row.position || row.role)
  if (!hasTitle) return false
  const signalKeys = [
    'company',
    'organization',
    'employer',
    'location',
    'requirements',
    'salary',
    'salary_range',
    'work_mode',
    'responsibilities',
    'benefits',
    'application_steps',
    'faq',
    'important_notes',
    'url',
    'link',
    'source_url',
    'job_url',
    'apply_url',
    'match_reason',
    'visa_note',
    'seniority',
  ]
  return signalKeys.some((key) => key in row) || Boolean(
    row.title ||
      row.job_title ||
      row.position ||
      row.role ||
      row.company ||
      row.organization ||
      row.employer ||
      row.url ||
      row.link ||
      row.job_url ||
      row.source_url,
  )
}

function recordKey(record: Record<string, unknown>): string {
  const title = normalizeToken(record.title || record.job_title || record.position || record.role)
  const company = normalizeToken(record.company || record.organization || record.employer)
  const link = normalizeToken(record.source_url || record.url || record.link || record.job_url || record.apply_url)
  return [title, company, link].join('::')
}

function collectJobRecords(payload: unknown): Array<Record<string, unknown>> {
  const records: Array<Record<string, unknown>> = []
  const seenKeys = new Set<string>()
  const seenObjects = new WeakSet<object>()

  const walk = (node: unknown, depth = 0): void => {
    if (depth > 8 || node == null) return

    if (typeof node === 'string') {
      const parsed = tryParseJson(node)
      if (parsed) walk(parsed, depth + 1)
      return
    }

    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1)
      return
    }

    if (typeof node !== 'object') return
    if (seenObjects.has(node)) return
    seenObjects.add(node)

    const obj = node as Record<string, unknown>
    if (looksLikeJobRecord(obj)) {
      const key = recordKey(obj)
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        records.push(obj)
      }
    }

    const preferredKeys = [
      'resultJson',
      'result_json',
      'result',
      'results',
      'items',
      'listings',
      'jobs',
      'opportunities',
      'data',
      'output',
      'payload',
      'response',
      'content',
      'message',
      'text',
    ]
    for (const key of preferredKeys) {
      if (key in obj) walk(obj[key], depth + 1)
    }
    for (const value of Object.values(obj)) {
      if (typeof value === 'string' || Array.isArray(value) || (value && typeof value === 'object')) {
        walk(value, depth + 1)
      }
    }
  }

  walk(payload)
  return records
}

function pickText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = asText(record[key])
    if (value) return value
  }
  return ''
}

function normalizeConfidence(value: unknown): ConfidenceLevel | undefined {
  const raw = normalizeToken(value)
  if (!raw) return undefined
  if (raw.includes('high')) return 'high'
  if (raw.includes('medium') || raw.includes('med')) return 'medium'
  if (raw.includes('low')) return 'low'
  return undefined
}

function confidenceToMatchScore(confidence: ConfidenceLevel | undefined): number | undefined {
  if (!confidence) return undefined
  if (confidence === 'high') return 92
  if (confidence === 'medium') return 78
  return 64
}

function extractSalaryHint(text: string): string {
  if (!text) return ''
  const match = text.match(
    /((?:[$€£₦]|USD|EUR|GBP|NGN)\s?\d[\d,]*(?:\s?-\s?(?:[$€£₦]|USD|EUR|GBP|NGN)?\s?\d[\d,]*)?(?:\s*(?:\/|per)\s*(?:year|month|hour|annum|yr|mo|hr))?)/i,
  )
  return match?.[1]?.trim() || ''
}

type NormalizedJob = {
  title: string
  company: string
  location: string
  sourceUrl: string
  summary: string
  seniority: string
  employmentType: string
  workMode: string
  postedDate: string
  applicationDeadline: string
  salary: string
  matchReason: string
  requirements: string[]
  responsibilities: string[]
  benefits: string[]
  applicationSteps: string[]
  faq: string[]
  importantNotes: string
  visaNote: string
  confidence?: ConfidenceLevel
  matchScore?: number
}

function normalizeJobs(records: Array<Record<string, unknown>>): NormalizedJob[] {
  const items: NormalizedJob[] = []
  const seen = new Set<string>()

  for (const raw of records) {
    const title = pickText(raw, ['title', 'role', 'job_title', 'position'])
    const company = pickText(raw, ['company', 'organization', 'employer', 'hiring_company']) || 'Unknown'
    if (!title) continue

    const sourceUrl = pickText(raw, ['source_url', 'apply_link', 'application_url', 'official_url', 'url', 'link', 'job_url', 'apply_url'])
    const requirements = asStringList(raw.requirements)
    const responsibilities = asStringList(raw.responsibilities || raw.duties || raw.tasks || raw.what_youll_do)
    const benefits = asStringList(raw.benefits || raw.perks || raw.what_we_offer)
    const applicationSteps = asStringList(raw.application_steps || raw.steps_to_apply || raw.how_to_apply || raw.apply_steps)
    const faq = asStringList(raw.faq || raw.candidate_faq || raw.job_faq)

    const summary =
      pickText(raw, ['description', 'summary', 'snippet', 'job_summary', 'requirements_text']) ||
      [pickText(raw, ['match_reason', 'why_match']), requirements.slice(0, 2).join('; ')].filter(Boolean).join(' ')

    const salary =
      pickText(raw, ['salary', 'salary_range', 'compensation', 'pay', 'remuneration', 'salary_band', 'salary_info']) ||
      extractSalaryHint(summary) ||
      'Not stated'

    const confidence = normalizeConfidence(raw.confidence)
    const explicitScore = toNumberOrUndefined(raw.matchScore ?? raw.match_score ?? raw.score)
    const matchReason =
      pickText(raw, ['match_reason', 'why_match', 'fit_summary', 'alignment_reason']) ||
      'Strong relevance to your selected role and filters.'

    const item: NormalizedJob = {
      title,
      company,
      location: pickText(raw, ['location', 'work_location', 'city', 'country', 'remote_type', 'work_mode']) || 'N/A',
      sourceUrl,
      summary,
      seniority: pickText(raw, ['seniority', 'level']) || 'N/A',
      employmentType: pickText(raw, ['employment_type', 'job_type', 'contract_type', 'engagement_type']) || 'N/A',
      workMode: pickText(raw, ['work_mode', 'remote_type', 'work_arrangement']) || 'N/A',
      postedDate: pickText(raw, ['posted_date', 'date_posted', 'published_at', 'listed_at', 'created_at']) || 'N/A',
      applicationDeadline: pickText(raw, ['application_deadline', 'deadline', 'apply_by', 'closing_date', 'expires_at']) || 'N/A',
      salary,
      matchReason,
      requirements: dedupeStrings(requirements).slice(0, 8),
      responsibilities: dedupeStrings(responsibilities).slice(0, 6),
      benefits: dedupeStrings(benefits).slice(0, 6),
      applicationSteps: dedupeStrings(applicationSteps).slice(0, 5),
      faq: dedupeStrings(faq).slice(0, 5),
      importantNotes: pickText(raw, ['important_notes', 'notes', 'caveats', 'eligibility_notes', 'geo_restrictions']),
      visaNote: pickText(raw, ['visa_note', 'visa', 'visa_sponsorship']) || 'unclear',
      confidence,
      matchScore: explicitScore ?? confidenceToMatchScore(confidence),
    }

    const key = [item.title.toLowerCase(), item.company.toLowerCase(), item.sourceUrl.toLowerCase()].join('::')
    if (seen.has(key)) continue
    seen.add(key)
    items.push(item)
  }

  return items
}

function buildDescription(job: NormalizedJob): string {
  const lines: string[] = []
  if (job.matchReason) lines.push(`Match reason: ${job.matchReason}`)
  const roleMeta = [job.seniority, job.employmentType, job.workMode].filter((v) => v && v !== 'N/A').join(' • ')
  if (roleMeta) lines.push(`Role details: ${roleMeta}`)
  if (job.salary && job.salary !== 'Not stated') lines.push(`Salary: ${job.salary}`)
  if (job.postedDate && job.postedDate !== 'N/A') lines.push(`Posted: ${job.postedDate}`)
  if (job.applicationDeadline && job.applicationDeadline !== 'N/A') lines.push(`Apply by: ${job.applicationDeadline}`)
  if (job.summary) lines.push(job.summary)
  if (job.responsibilities.length) lines.push(`Responsibilities: ${job.responsibilities.slice(0, 3).join('; ')}`)
  if (job.benefits.length) lines.push(`Benefits: ${job.benefits.slice(0, 3).join('; ')}`)
  if (job.applicationSteps.length) lines.push(`Apply steps: ${job.applicationSteps.slice(0, 3).join('; ')}`)
  if (job.importantNotes) lines.push(`Notes: ${job.importantNotes}`)
  return lines.join('\n')
}

function toOpportunities(items: NormalizedJob[], type: 'job' | 'scholarship' | 'visa'): Opportunity[] {
  return items.map((it, idx) => ({
    id: String(`${type}-${Date.now()}-${idx}`),
    type,
    title: it.title,
    organization: it.company,
    location: it.location,
    description: buildDescription(it),
    requirements: it.requirements,
    link: it.sourceUrl,
    deadline: it.applicationDeadline !== 'N/A' ? it.applicationDeadline : undefined,
    matchScore: it.matchScore,
    salary: it.salary,
    seniority: it.seniority !== 'N/A' ? it.seniority : undefined,
    employmentType: it.employmentType !== 'N/A' ? it.employmentType : undefined,
    workMode: it.workMode !== 'N/A' ? it.workMode : undefined,
    postedDate: it.postedDate !== 'N/A' ? it.postedDate : undefined,
    matchReason: it.matchReason,
    responsibilities: it.responsibilities,
    benefits: it.benefits,
    applicationSteps: it.applicationSteps,
    faq: it.faq,
    importantNotes: it.importantNotes || undefined,
    confidence: it.confidence,
    sourceUrl: it.sourceUrl || undefined,
  }))
}

function textFromCriteria(criteria: JobSearchCriteria, key: string, fallback: string, blocked: string[] = ['any', 'skip']): string {
  const value = asText(criteria[key])
  if (!value) return fallback
  const normalized = value.toLowerCase()
  if (blocked.includes(normalized)) return fallback
  return value
}

function buildLinkedinUrl(query: string, criteria: JobSearchCriteria): string {
  const keywords = query || textFromCriteria(criteria, 'job_title', 'Software Engineer')
  const location = textFromCriteria(criteria, 'job_location', 'Remote', ['any', 'skip', 'global'])
  return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}`
}

function buildGoogleJobsUrl(query: string, criteria: JobSearchCriteria): string {
  const keywords = query || textFromCriteria(criteria, 'job_title', 'Software Engineer')
  const location = textFromCriteria(criteria, 'job_location', 'Remote', ['any', 'skip', 'global'])
  const googleQuery = `${keywords} ${location} jobs`
  return `https://www.google.com/search?ibp=htl;jobs&q=${encodeURIComponent(googleQuery)}`
}

function buildIndeedUrl(query: string, criteria: JobSearchCriteria): string {
  const keywords = query || textFromCriteria(criteria, 'job_title', 'Software Engineer')
  const location = textFromCriteria(criteria, 'job_location', 'Remote', ['any', 'skip', 'global'])
  return `https://www.indeed.com/jobs?q=${encodeURIComponent(keywords)}&l=${encodeURIComponent(location)}`
}

function buildJobGoal(
  query: string,
  criteria: JobSearchCriteria,
  maxResults: number,
  sourceName: string,
  options?: { strictSourceOnly?: boolean },
): string {
  const roleLevel = textFromCriteria(criteria, 'job_level', 'Any')
  const roleKeywords = textFromCriteria(criteria, 'job_title', query || 'Any')
  const focus = textFromCriteria(criteria, 'job_focus', 'Any')
  const location = textFromCriteria(criteria, 'job_location', 'Any', ['skip', 'global'])
  const workMode = textFromCriteria(criteria, 'job_mode', 'Any')
  const skills = textFromCriteria(criteria, 'job_stack', 'Any', ['skip'])
  const visa = textFromCriteria(criteria, 'job_visa', 'Any', ['skip'])
  const salaryBand = textFromCriteria(criteria, 'job_salary', 'Any', ['skip'])
  const companyType = textFromCriteria(criteria, 'job_company', 'Any')
  const preferredSources = textFromCriteria(criteria, 'job_source', DEFAULT_JOB_SOURCES, ['skip', 'any'])
  const allowOtherSources = normalizeToken(criteria.job_source) === normalizeToken('All + Other Trusted Sites')

  const outputShape = {
    results: [
      {
        title: 'Role title',
        company: 'Company name',
        location: 'Location / remote type',
        seniority: 'Internship/Entry/Mid/Senior',
        employment_type: 'Full-time/Part-time/Contract/Internship or N/A',
        work_mode: 'Remote/Hybrid/Onsite or N/A',
        posted_date: 'YYYY-MM-DD or relative date, or N/A',
        application_deadline: 'YYYY-MM-DD or N/A',
        salary: 'Expected salary/range with currency and period, or Not stated',
        match_reason: "1-2 lines explaining why this job matches the selected criteria",
        requirements: ['req 1', 'req 2', 'req 3'],
        responsibilities: ['task 1', 'task 2'],
        benefits: ['benefit 1', 'benefit 2'],
        application_steps: ['step 1', 'step 2'],
        faq: ['faq item 1', 'faq item 2'],
        important_notes: 'Location/visa/restriction caveats users should know',
        source_url: 'Official apply URL',
        visa_note: 'mentioned | unclear',
        confidence: 'high | medium | low',
      },
    ],
  }

  return [
    'You are finding job opportunities from trusted public job boards and official company career pages.',
    `Primary source for this run: ${sourceName}.`,
    ...(options?.strictSourceOnly
      ? [
          `For this run, collect jobs from ${sourceName} only.`,
          'Do not switch this run to another job board.',
        ]
      : []),
    'Prefer sources like LinkedIn Jobs, Indeed, Jobberman, MyJobMag, Djinni (Tech Jobs), and company career pages.',
    'Prefer official application links and avoid duplicates.',
    'Prioritize results that best match selected criteria: role keywords, industry, location, work mode, skills, visa preference, salary band, and company type.',
    `Role level: ${roleLevel}`,
    `Role keywords: ${roleKeywords}`,
    `Industry/field: ${focus}`,
    `Location: ${location}`,
    `Work mode: ${workMode}`,
    `Skills/tools (optional): ${skills}`,
    `Visa sponsorship needed: ${visa}`,
    `Company type: ${companyType}`,
    `Salary band: ${salaryBand}`,
    `Preferred primary sources: ${preferredSources}`,
    'Include salary information whenever available on the posting.',
    "If salary is missing, set salary to 'Not stated'.",
    "For each result, include a short 'match_reason' tied to selected criteria.",
    'Provide practical apply-ready context: responsibilities, benefits, application steps, FAQ, and important notes when available.',
    'Do not overly shorten requirements; include the most actionable 5-8 items when present.',
    `Search other trusted sources too: ${allowOtherSources ? 'yes' : 'no'}`,
    `Return up to ${maxResults} items.`,
    'Return strict JSON only using this shape:',
    JSON.stringify(outputShape),
  ].join('\n')
}

function dedupeOpportunities(items: Opportunity[]): Opportunity[] {
  const seen = new Set<string>()
  const output: Opportunity[] = []

  for (const row of items) {
    const key = [
      normalizeToken(row.title),
      normalizeToken(row.organization),
      normalizeToken(row.link || row.sourceUrl || ''),
    ].join('::')
    if (seen.has(key)) continue
    seen.add(key)
    output.push(row)
  }

  return output
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function extractRunPayload(run: TinyfishRunStatusResponse | null | undefined): unknown {
  if (!run || typeof run !== 'object') return null
  const anyRun = run as any
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

function pollingIntervalForElapsed(elapsedMs: number): number {
  if (elapsedMs < 60_000) return SHORT_TASK_POLL_MS
  if (elapsedMs < 5 * 60_000) return MEDIUM_TASK_POLL_MS
  return LONG_TASK_POLL_MS
}

export const tinyfishService = {
  async run(req: TinyfishRunRequest): Promise<TinyfishSseEvent> {
    const token = localStorage.getItem('tinyworker.access_token') || ''
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), TINYFISH_PROXY_TIMEOUT_MS)
    try {
      const res = await fetch(tinyfishRunEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(req),
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(
          `TinyFish proxy failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`
        )
      }

      return (await res.json()) as TinyfishSseEvent
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        throw new Error(`TinyFish search timed out after ${Math.round(TINYFISH_PROXY_TIMEOUT_MS / 1000)}s`)
      }
      throw e
    } finally {
      window.clearTimeout(timeout)
    }
  },

  async runBatch(runs: TinyfishRunRequest[]): Promise<TinyfishBatchRunResponse> {
    const token = localStorage.getItem('tinyworker.access_token') || ''
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), TINYFISH_PROXY_TIMEOUT_MS)
    try {
      const res = await fetch(tinyfishRunBatchEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ runs }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(
          `TinyFish batch proxy failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`,
        )
      }

      return (await res.json()) as TinyfishBatchRunResponse
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        throw new Error(`TinyFish batch start timed out after ${Math.round(TINYFISH_PROXY_TIMEOUT_MS / 1000)}s`)
      }
      throw e
    } finally {
      window.clearTimeout(timeout)
    }
  },

  async runAsync(req: TinyfishRunRequest): Promise<TinyfishAsyncRunResponse> {
    const token = localStorage.getItem('tinyworker.access_token') || ''
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), TINYFISH_PROXY_TIMEOUT_MS)
    try {
      const res = await fetch(tinyfishRunAsyncEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(req),
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(
          `TinyFish async proxy failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`,
        )
      }

      return (await res.json()) as TinyfishAsyncRunResponse
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        throw new Error(`TinyFish async start timed out after ${Math.round(TINYFISH_PROXY_TIMEOUT_MS / 1000)}s`)
      }
      throw e
    } finally {
      window.clearTimeout(timeout)
    }
  },

  async getRunById(runId: string): Promise<TinyfishRunStatusResponse> {
    const token = localStorage.getItem('tinyworker.access_token') || ''
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), TINYFISH_PROXY_TIMEOUT_MS)
    try {
      const res = await fetch(tinyfishRunByIdEndpoint(runId), {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(
          `TinyFish run status failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`,
        )
      }

      return (await res.json()) as TinyfishRunStatusResponse
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        throw new Error(`TinyFish run status timed out after ${Math.round(TINYFISH_PROXY_TIMEOUT_MS / 1000)}s`)
      }
      throw e
    } finally {
      window.clearTimeout(timeout)
    }
  },

  async waitForRunCompletion(runId: string): Promise<TinyfishRunStatusResponse> {
    const startedAt = Date.now()
    let completedWithoutPayloadCount = 0
    while (true) {
      const run = await this.getRunById(runId)
      const status = String(run.status || '').toUpperCase()

      if (status === 'COMPLETED') {
        const payload = extractRunPayload(run)
        if (payload != null) return run
        // Some providers expose COMPLETED slightly before result payload is attached.
        completedWithoutPayloadCount += 1
        if (completedWithoutPayloadCount >= 6) return run
      }

      if (status === 'FAILED' || status === 'CANCELLED') {
        return run
      }

      const elapsed = Date.now() - startedAt
      if (elapsed >= MULTI_SOURCE_RUN_TIMEOUT_MS) {
        throw new Error(
          `TinyFish run ${runId} timed out after ${Math.round(MULTI_SOURCE_RUN_TIMEOUT_MS / 1000)}s`,
        )
      }

      await wait(pollingIntervalForElapsed(elapsed))
    }
  },

  async searchJobsMultiSource(query: string, criteria: JobSearchCriteria = {}): Promise<Opportunity[]> {
    const runs: TinyfishRunRequest[] = [
      {
        url: buildLinkedinUrl(query, criteria),
        goal: buildJobGoal(query, criteria, DEFAULT_JOB_RESULTS_LIMIT, 'LinkedIn Jobs', { strictSourceOnly: true }),
        browser_profile: 'stealth',
        proxy_config: { enabled: false },
        feature_flags: { enable_agent_memory: false },
        api_integration: 'tinyfinder-ui-linkedin',
      },
      {
        url: buildGoogleJobsUrl(query, criteria),
        goal: buildJobGoal(query, criteria, DEFAULT_JOB_RESULTS_LIMIT, 'Google Jobs', { strictSourceOnly: true }),
        browser_profile: 'stealth',
        proxy_config: { enabled: false },
        feature_flags: { enable_agent_memory: false },
        api_integration: 'tinyfinder-ui-google-jobs',
      },
      {
        url: buildIndeedUrl(query, criteria),
        goal: buildJobGoal(query, criteria, DEFAULT_JOB_RESULTS_LIMIT, 'Indeed', { strictSourceOnly: true }),
        browser_profile: 'stealth',
        proxy_config: { enabled: false },
        feature_flags: { enable_agent_memory: false },
        api_integration: 'tinyfinder-ui-indeed',
      },
    ]

    // Start each source explicitly so sessions are isolated per source.
    const started = await Promise.allSettled(runs.map((req) => this.runAsync(req)))
    const runIds = started
      .flatMap((row) => (row.status === 'fulfilled' ? [String(row.value?.run_id || '').trim()] : []))
      .filter(Boolean)

    if (!runIds.length) {
      const startErrors = started
        .flatMap((row) => (row.status === 'rejected' ? [row.reason?.message || String(row.reason || 'Unknown error')] : []))
        .slice(0, 3)
      const detail = startErrors.length ? ` Details: ${startErrors.join(' | ')}` : ''
      throw new Error(`TinyFish did not return run IDs for async multi-source search.${detail}`)
    }

    const uniqueRunIds = Array.from(new Set(runIds))
    const settled = await Promise.allSettled(uniqueRunIds.map((runId) => this.waitForRunCompletion(runId)))

    const completedPayloads: unknown[] = []
    const failedReasons: string[] = []
    for (const item of settled) {
      if (item.status === 'rejected') {
        failedReasons.push(item.reason?.message || String(item.reason || 'Unknown async error'))
        continue
      }

      const run = item.value
      const status = String(run.status || '').toUpperCase()
      if (status === 'COMPLETED') {
        const payload = extractRunPayload(run)
        if (payload != null) completedPayloads.push(payload)
        else failedReasons.push(`Run ${run.run_id} completed without payload`)
      } else if (status === 'FAILED') {
        const reason = run.error?.message || run.error?.details || 'Unknown run error'
        failedReasons.push(String(reason))
      } else if (status === 'CANCELLED') {
        failedReasons.push(`Run ${run.run_id} was cancelled`)
      }
    }

    if (!completedPayloads.length) {
      const detail = failedReasons.length ? ` Details: ${failedReasons.slice(0, 3).join(' | ')}` : ''
      throw new Error(`TinyFish multi-source search returned no completed runs.${detail}`)
    }

    const mergedRecords = completedPayloads.flatMap((payload) => collectJobRecords(payload))
    const normalized = normalizeJobs(mergedRecords)
    const opportunities = toOpportunities(normalized.slice(0, DEFAULT_JOB_RESULTS_LIMIT * 3), 'job')
    const deduped = dedupeOpportunities(opportunities)
    return deduped.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0)).slice(0, DEFAULT_JOB_RESULTS_LIMIT)
  },

  async searchJobsLinkedIn(query: string, criteria: JobSearchCriteria = {}): Promise<Opportunity[]> {
    return await this.searchJobsMultiSource(query, criteria)
  },
}
