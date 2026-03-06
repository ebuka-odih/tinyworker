import type { SearchRunResultItem } from './job-search-run.store'
import type { ValyuDiscoveredCandidate } from './valyu-search.service'

const TRACKING_QUERY_KEYS = new Set([
  'fbclid',
  'gclid',
  'gh_jid',
  'gh_src',
  'jkfrom',
  'lever-source',
  'ref',
  'referrer',
  'source',
  'trk',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term',
])

const BLOCKED_TITLE_PATTERNS = [
  /\bapply today\b/i,
  /\bbrowse [\d,]+ .*job openings\b/i,
  /\bjob search\b/i,
  /\bjob openings\b/i,
  /\bjobs in\b/i,
  /\bsearch results\b/i,
  /\bview all jobs\b/i,
]

const BLOCKED_QUERY_KEYS = new Set(['l', 'location', 'page', 'q', 'query', 'radius', 'search', 'sort'])
const BLOCKED_TERMINAL_SEGMENTS = new Set([
  'all-jobs',
  'careers',
  'jobs',
  'open-positions',
  'positions',
  'results',
  'roles',
  'search',
  'vacancies',
])

function normalizeText(value: string | undefined | null): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s/_-]+/g, ' ')
    .replace(/[^\w\s]/g, '')
}

function toHost(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return value.toLowerCase().replace(/^www\./, '')
  }
}

function titleLooksLikeListingPage(title: string | undefined | null): boolean {
  const normalized = String(title || '').trim()
  if (!normalized) return false
  return BLOCKED_TITLE_PATTERNS.some((pattern) => pattern.test(normalized))
}

function getPathSegments(url: URL): string[] {
  return url.pathname
    .split('/')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
}

function hasBlockedSearchParams(url: URL): boolean {
  for (const key of url.searchParams.keys()) {
    if (BLOCKED_QUERY_KEYS.has(key.toLowerCase())) return true
  }
  return false
}

function isLinkedInJobUrl(url: URL): boolean {
  return /^\/jobs\/view\/[^/]+\/?$/.test(url.pathname.toLowerCase())
}

function isIndeedJobUrl(url: URL): boolean {
  const path = url.pathname.toLowerCase()
  if (path === '/viewjob') {
    return url.searchParams.has('jk') || url.searchParams.has('vjk')
  }
  if (!path.startsWith('/cmp/')) return false
  const segments = getPathSegments(url)
  const jobsIndex = segments.indexOf('jobs')
  return jobsIndex >= 0 && Boolean(segments[jobsIndex + 1])
}

function isGlassdoorJobUrl(url: URL): boolean {
  return url.pathname.toLowerCase().includes('/job-listing/')
}

function isGreenhouseJobUrl(url: URL): boolean {
  const segments = getPathSegments(url)
  const jobsIndex = segments.indexOf('jobs')
  return jobsIndex >= 0 && Boolean(segments[jobsIndex + 1])
}

function isLeverJobUrl(url: URL): boolean {
  const segments = getPathSegments(url)
  return segments.length >= 2 && !BLOCKED_TERMINAL_SEGMENTS.has(segments[segments.length - 1] || '')
}

function isAshbyJobUrl(url: URL): boolean {
  const segments = getPathSegments(url)
  const jobIndex = segments.indexOf('job')
  return jobIndex >= 0 && Boolean(segments[jobIndex + 1])
}

function isGenericJobUrl(url: URL): boolean {
  const segments = getPathSegments(url)
  if (!segments.length) return false
  if (hasBlockedSearchParams(url)) return false
  const terminal = segments[segments.length - 1]
  if (!terminal || BLOCKED_TERMINAL_SEGMENTS.has(terminal)) return false

  const jobKeywordIndex = segments.findIndex((segment) =>
    ['career', 'careers', 'job', 'jobs', 'listing', 'role', 'vacancy', 'vacancies'].includes(segment),
  )
  if (jobKeywordIndex >= 0) {
    return Boolean(segments[jobKeywordIndex + 1])
  }

  return segments.length >= 2
}

export function canonicalizeJobUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (TRACKING_QUERY_KEYS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key)
      }
    }
    parsed.searchParams.sort()
    if (!parsed.searchParams.toString()) {
      parsed.search = ''
    }
    return parsed.toString()
  } catch {
    return null
  }
}

export function normalizeDiscoveryQuery(query: string): string {
  const normalized = String(query || '')
    .replace(/\bjobs?\s+in\s+any location\b/gi, ' ')
    .replace(/\bany location\b/gi, ' ')
    .replace(/\bjobs?\b/gi, ' ')
    .replace(/\bwith visa sponsorship\b/gi, ' visa sponsorship ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || String(query || '').trim()
}

export function isLikelyJobPostingCandidate(candidate: Pick<ValyuDiscoveredCandidate, 'title' | 'url'>): boolean {
  if (!canonicalizeJobUrl(candidate.url)) return false
  if (titleLooksLikeListingPage(candidate.title)) return false

  try {
    const parsed = new URL(candidate.url)
    const host = toHost(parsed.hostname)
    if (host.endsWith('linkedin.com')) return isLinkedInJobUrl(parsed)
    if (host.endsWith('indeed.com')) return isIndeedJobUrl(parsed)
    if (host.endsWith('glassdoor.com')) return isGlassdoorJobUrl(parsed)
    if (host.endsWith('greenhouse.io')) return isGreenhouseJobUrl(parsed)
    if (host.endsWith('lever.co')) return isLeverJobUrl(parsed)
    if (host.endsWith('ashbyhq.com')) return isAshbyJobUrl(parsed)
    return isGenericJobUrl(parsed)
  } catch {
    return false
  }
}

export function deriveCandidateJobDetails(rawTitle: string): { title: string; organization?: string } {
  const title = String(rawTitle || '').trim()
  if (!title) return { title: '' }

  const greenhouseMatch = title.match(/^Job Application for\s+(.+?)\s+at\s+(.+)$/i)
  if (greenhouseMatch) {
    return {
      title: greenhouseMatch[1]?.trim() || title,
      organization: greenhouseMatch[2]?.trim() || undefined,
    }
  }

  const companyFirstMatch = title.match(/^(.+?)\s+-\s+(.+)$/)
  if (companyFirstMatch) {
    return {
      title: companyFirstMatch[2]?.trim() || title,
      organization: companyFirstMatch[1]?.trim() || undefined,
    }
  }

  return { title }
}

function discoveryScore(candidate: ValyuDiscoveredCandidate): number {
  const title = normalizeText(candidate.title)
  return (candidate.sourceVerified ? 10 : 0) + (candidate.snippet ? 2 : 0) + (title.length > 12 ? 1 : 0) + (candidate.relevance || 0)
}

export function filterAndDeduplicateDiscoveredCandidates(
  candidates: ValyuDiscoveredCandidate[],
): ValyuDiscoveredCandidate[] {
  const byCanonicalUrl = new Map<string, ValyuDiscoveredCandidate>()

  for (const candidate of candidates) {
    const canonicalUrl = canonicalizeJobUrl(candidate.url)
    if (!canonicalUrl) continue
    if (!isLikelyJobPostingCandidate(candidate)) continue

    const normalized: ValyuDiscoveredCandidate = {
      ...candidate,
      url: canonicalUrl,
    }

    const existing = byCanonicalUrl.get(canonicalUrl)
    if (!existing || discoveryScore(normalized) > discoveryScore(existing)) {
      byCanonicalUrl.set(canonicalUrl, normalized)
    }
  }

  return Array.from(byCanonicalUrl.values()).sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
}

function resultIdentityKey(item: SearchRunResultItem): string {
  const title = normalizeText(item.title)
  const organization = normalizeText(item.organization)
  if (!title || !organization) return `id:${item.id}`
  const location = normalizeText(item.location)
  return `${title}::${organization}::${location || 'unknown'}`
}

function readyResultScore(item: SearchRunResultItem): number {
  const populatedFields = [
    item.title,
    item.organization,
    item.location,
    item.salary,
    item.employmentType,
    item.workMode,
    item.postedDate,
    item.matchReason,
    item.snippet,
    ...(item.requirements || []),
    ...(item.responsibilities || []),
    ...(item.benefits || []),
  ].filter((value) => String(value || '').trim().length > 0).length

  return (
    populatedFields * 5 +
    (item.sourceVerified ? 3 : 0) +
    (item.relevance || 0) +
    (item.queueStatus === 'ready' || item.queueStatus === 'verified' ? 1 : 0)
  )
}

export function deduplicateReadyResults(results: SearchRunResultItem[]): SearchRunResultItem[] {
  const byIdentity = new Map<string, SearchRunResultItem>()

  for (const result of results) {
    const key = resultIdentityKey(result)
    const existing = byIdentity.get(key)
    if (!existing || readyResultScore(result) > readyResultScore(existing)) {
      byIdentity.set(key, result)
    }
  }

  return Array.from(byIdentity.values())
}

export function extractedTitleLooksValid(title: string | undefined | null): boolean {
  const normalized = String(title || '').trim()
  if (!normalized) return false
  return !titleLooksLikeListingPage(normalized)
}
