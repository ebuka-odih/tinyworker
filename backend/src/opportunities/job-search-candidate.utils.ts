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

const SCHOLARSHIP_KEYWORDS = ['scholarship', 'scholarships', 'fellowship', 'fellowships', 'grant', 'grants', 'bursary', 'bursaries', 'funding']
const BLOCKED_SCHOLARSHIP_TITLE_PATTERNS = [
  /\bapplicant advice\b/i,
  /\bapplication advice\b/i,
  /\bapplication guide\b/i,
  /\babout us\b/i,
  /\beligible courses?\b/i,
  /\bfilter search\b/i,
  /\bfinancial allowances\b/i,
  /\bhow to apply\b/i,
  /\bfrequently asked questions\b/i,
  /\bfaq\b/i,
  /\bguidance\b/i,
  /\bmeet your programme officers\b/i,
  /\bprogramme officers?\b/i,
  /\bscholarships and fellowships\b/i,
  /\buniversity bid(?:ding|s?)\b/i,
  /\bwebinar\b/i,
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

const BLOCKED_SCHOLARSHIP_SEGMENTS = new Set([
  'advice',
  'admissions',
  'advice-for-applicants',
  'applicant-advice',
  'application-guide',
  'apply',
  'about-us',
  'blog',
  'contact',
  'events',
  'faq',
  'faqs',
  'filter-search',
  'financial-allowances',
  'guidance',
  'handbook',
  'how-to-apply',
  'information',
  'meet-your-programme-officers',
  'news',
  'programme-officers',
  'resources',
  'search',
  'scholarships-and-fellowships',
  'university-bidding',
  'university-bids',
  'eligible-courses',
  'webinars',
])

const SCHOLARSHIP_FAMILY_NOISE_PATTERNS = [
  /\babout us\b/g,
  /\bapplicant advice\b/g,
  /\bapplication advice\b/g,
  /\bapplication guide\b/g,
  /\beligible courses?\b/g,
  /\bfaq\b/g,
  /\bfaqs\b/g,
  /\bfinancial allowances\b/g,
  /\bhow to apply\b/g,
  /\bmeet your programme officers\b/g,
  /\bprogramme officers?\b/g,
  /\bscholarships and fellowships\b/g,
  /\buniversity bid(?:ding|s?)\b/g,
]

const SCHOLARSHIP_FAMILY_STOP_WORDS = new Set([
  'about',
  'advice',
  'apply',
  'application',
  'eligible',
  'fellowships',
  'financial',
  'for',
  'guide',
  'guidance',
  'handbook',
  'in',
  'officers',
  'programme',
  'scholarships',
  'search',
  'the',
  'to',
  'uk',
])

const MAX_ALLOWED_AGE_DAYS_FALLBACK = 21

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

function titleLooksLikeScholarshipAdvicePage(title: string | undefined | null): boolean {
  const normalized = String(title || '').trim()
  if (!normalized) return false
  return BLOCKED_SCHOLARSHIP_TITLE_PATTERNS.some((pattern) => pattern.test(normalized))
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

function asValidDate(value: string): Date | null {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function ageInDaysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

function parseRelativeAgeToken(value: string): number | null {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return null

  const compactMatch = normalized.match(/(?:^|[\s•·|,;:()\-])(\d+)\s*(m|h|d|w|mo|y)(?:[\s•·|,;:()\-]|$)/i)
  if (compactMatch) {
    const amount = Number(compactMatch[1] || 0)
    const unit = String(compactMatch[2] || '').toLowerCase()
    if (unit === 'm' || unit === 'h') return 0
    if (unit === 'd') return amount
    if (unit === 'w') return amount * 7
    if (unit === 'mo') return amount * 30
    if (unit === 'y') return amount * 365
  }

  const longMatch = normalized.match(/\b(\d+)\s+(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\s+ago\b/i)
  if (longMatch) {
    const amount = Number(longMatch[1] || 0)
    const unit = String(longMatch[2] || '').toLowerCase()
    if (unit.startsWith('minute') || unit.startsWith('hour')) return 0
    if (unit.startsWith('day')) return amount
    if (unit.startsWith('week')) return amount * 7
    if (unit.startsWith('month')) return amount * 30
    if (unit.startsWith('year')) return amount * 365
  }

  return null
}

export function isRecentJobPostingValue(value: string | undefined | null, maxAgeDays = MAX_ALLOWED_AGE_DAYS_FALLBACK): boolean {
  const normalized = String(value || '').trim()
  if (!normalized) return true

  const directDate = asValidDate(normalized)
  if (directDate) {
    return ageInDaysSince(directDate) <= maxAgeDays
  }

  const relativeAgeDays = parseRelativeAgeToken(normalized)
  if (relativeAgeDays == null) return true
  return relativeAgeDays <= maxAgeDays
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

function isDjinniJobUrl(url: URL): boolean {
  const segments = getPathSegments(url)
  if (segments[0] !== 'jobs') return false
  if (!segments[1]) return false
  const second = segments[1]
  if (second.startsWith('l-') || second.startsWith('keyword-') || second.startsWith('company-')) return false
  return /^\d+[-a-z0-9]*$/i.test(second)
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

function titleHasScholarshipKeyword(title: string | undefined | null): boolean {
  const normalized = normalizeText(title)
  if (!normalized) return false
  return SCHOLARSHIP_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

function pathHasScholarshipKeyword(segments: string[]): boolean {
  return segments.some((segment) => SCHOLARSHIP_KEYWORDS.some((keyword) => segment.includes(keyword)))
}

function isScholarshipPortalUrl(url: URL): boolean {
  const segments = getPathSegments(url)
  const index = segments.indexOf('scholarships')
  return index >= 0 && Boolean(segments[index + 1]) && !hasBlockedSearchParams(url)
}

function isMastersPortalScholarshipUrl(url: URL): boolean {
  const segments = getPathSegments(url)
  const index = segments.indexOf('scholarships')
  return index >= 0 && Boolean(segments[index + 1]) && !hasBlockedSearchParams(url)
}

function isBachelorstudiesScholarshipUrl(url: URL): boolean {
  const segments = getPathSegments(url)
  if (hasBlockedSearchParams(url)) return false
  return pathHasScholarshipKeyword(segments) && Boolean(segments[segments.length - 1])
}

function isScholarshipAdviceLikePath(url: URL): boolean {
  const segments = getPathSegments(url)
  return segments.some((segment) => BLOCKED_SCHOLARSHIP_SEGMENTS.has(segment))
}

function singularizeScholarshipToken(token: string): string {
  if (token === 'scholarships') return 'scholarship'
  if (token === 'fellowships') return 'fellowship'
  if (token === 'grants') return 'grant'
  if (token === 'bursaries') return 'bursary'
  return token
}

function cleanScholarshipFamilyText(value: string): string {
  let normalized = normalizeText(value)
  for (const pattern of SCHOLARSHIP_FAMILY_NOISE_PATTERNS) {
    normalized = normalized.replace(pattern, ' ')
  }

  return normalized
    .split(' ')
    .map((token) => singularizeScholarshipToken(token))
    .filter((token) => token && !SCHOLARSHIP_FAMILY_STOP_WORDS.has(token) && !/^\d{4,}$/.test(token))
    .join(' ')
    .trim()
}

function deriveScholarshipPathFamily(url: URL): string {
  const segments = getPathSegments(url)
    .filter((segment) => !BLOCKED_SCHOLARSHIP_SEGMENTS.has(segment))
    .filter((segment) => !BLOCKED_TERMINAL_SEGMENTS.has(segment))

  if (!segments.length) return ''

  const terminal = segments[segments.length - 1] || ''
  const meaningful = cleanScholarshipFamilyText(terminal.replace(/[-_]+/g, ' '))
  if (meaningful) return meaningful

  return cleanScholarshipFamilyText(segments.join(' '))
}

function isProviderScholarshipUrl(url: URL, title: string | undefined | null): boolean {
  const segments = getPathSegments(url)
  if (hasBlockedSearchParams(url)) return false
  if (isScholarshipAdviceLikePath(url)) return false
  if (!Boolean(segments[segments.length - 1])) return false
  return titleHasScholarshipKeyword(title) || pathHasScholarshipKeyword(segments)
}

function isGenericScholarshipUrl(url: URL, title: string | undefined | null): boolean {
  const segments = getPathSegments(url)
  if (!segments.length) return false
  if (hasBlockedSearchParams(url)) return false
  if (isScholarshipAdviceLikePath(url)) return false
  const terminal = segments[segments.length - 1]
  if (!terminal || BLOCKED_TERMINAL_SEGMENTS.has(terminal)) return false
  return titleHasScholarshipKeyword(title) || pathHasScholarshipKeyword(segments)
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

export function canonicalizeScholarshipUrl(url: string): string | null {
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
    if (host.endsWith('djinni.co')) return isDjinniJobUrl(parsed)
    return isGenericJobUrl(parsed)
  } catch {
    return false
  }
}

export function isLikelyScholarshipCandidate(candidate: Pick<ValyuDiscoveredCandidate, 'title' | 'url'>): boolean {
  if (!canonicalizeScholarshipUrl(candidate.url)) return false
  if (!titleHasScholarshipKeyword(candidate.title)) return false
  if (titleLooksLikeScholarshipAdvicePage(candidate.title)) return false

  try {
    const parsed = new URL(candidate.url)
    const host = toHost(parsed.hostname)
    if (host.endsWith('scholarshipportal.com')) return isScholarshipPortalUrl(parsed)
    if (host.endsWith('mastersportal.com')) return isMastersPortalScholarshipUrl(parsed)
    if (host.endsWith('bachelorstudies.com')) return isBachelorstudiesScholarshipUrl(parsed)
    if (host.endsWith('daad.de')) return isProviderScholarshipUrl(parsed, candidate.title)
    if (host.endsWith('chevening.org')) return isProviderScholarshipUrl(parsed, candidate.title)
    if (host.endsWith('cscuk.fcdo.gov.uk')) return isProviderScholarshipUrl(parsed, candidate.title)
    if (host.endsWith('opportunitiesforafricans.com')) return isProviderScholarshipUrl(parsed, candidate.title)
    return isGenericScholarshipUrl(parsed, candidate.title)
  } catch {
    return false
  }
}

export function scholarshipCandidateFamilyKey(
  candidate: Pick<ValyuDiscoveredCandidate, 'title' | 'url' | 'sourceDomain'>,
): string {
  const canonicalUrl = canonicalizeScholarshipUrl(candidate.url)
  if (!canonicalUrl) {
    const fallbackHost = toHost(String(candidate.sourceDomain || 'unknown'))
    const fallbackFamily = cleanScholarshipFamilyText(candidate.title || '') || normalizeText(candidate.title || '') || 'listing'
    return `${fallbackHost}::${fallbackFamily}`
  }

  try {
    const parsed = new URL(canonicalUrl)
    const host = toHost(parsed.hostname)
    const titleFamily = cleanScholarshipFamilyText(candidate.title || '')
    const pathFamily = deriveScholarshipPathFamily(parsed)
    const family = titleFamily || pathFamily || 'listing'
    return `${host}::${family}`
  } catch {
    const fallbackHost = toHost(String(candidate.sourceDomain || 'unknown'))
    const fallbackFamily = cleanScholarshipFamilyText(candidate.title || '') || normalizeText(candidate.title || '') || 'listing'
    return `${fallbackHost}::${fallbackFamily}`
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
  options?: { maxAgeDays?: number },
): ValyuDiscoveredCandidate[] {
  const byCanonicalUrl = new Map<string, ValyuDiscoveredCandidate>()
  const maxAgeDays = Math.max(1, Number(options?.maxAgeDays || MAX_ALLOWED_AGE_DAYS_FALLBACK))

  for (const candidate of candidates) {
    const canonicalUrl = canonicalizeJobUrl(candidate.url)
    if (!canonicalUrl) continue
    if (!isLikelyJobPostingCandidate(candidate)) continue
    if (!isRecentJobPostingValue(candidate.publicationDate, maxAgeDays)) continue

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

export function searchRunResultIdentityKey(item: SearchRunResultItem): string {
  const title = normalizeText(item.title)
  const organization = normalizeText(item.organization)
  if (!title || !organization) return `id:${item.id}`
  const location = normalizeText(item.location)
  return `${title}::${organization}::${location || 'unknown'}`
}

function isReadyLike(status: SearchRunResultItem['queueStatus']): boolean {
  return status === 'ready' || status === 'verified'
}

export function readyResultScore(item: SearchRunResultItem): number {
  const populatedFields = [
    item.title,
    item.organization,
    item.location,
    item.salary,
    item.employmentType,
    item.workMode,
    item.postedDate,
    item.deadline,
    item.studyLevel,
    item.fundingType,
    item.matchReason,
    item.snippet,
    ...(item.requirements || []),
    ...(item.responsibilities || []),
    ...(item.benefits || []),
  ].filter((value) => String(value || '').trim().length > 0).length

  return (
    populatedFields * 5 +
    (item.sourceVerified ? 3 : 0) +
    (item.relevance || 0) * 4 +
    (isReadyLike(item.queueStatus) ? 6 : item.queueStatus === 'extracting' ? 2 : item.queueStatus === 'queued' ? 1 : 0)
  )
}

export function filterAndDeduplicateScholarshipCandidates(
  candidates: ValyuDiscoveredCandidate[],
  options?: { maxAgeDays?: number },
): ValyuDiscoveredCandidate[] {
  const byCanonicalUrl = new Map<string, ValyuDiscoveredCandidate>()
  const maxAgeDays = Math.max(1, Number(options?.maxAgeDays || 365))

  for (const candidate of candidates) {
    const canonicalUrl = canonicalizeScholarshipUrl(candidate.url)
    if (!canonicalUrl) continue
    if (!isLikelyScholarshipCandidate(candidate)) continue
    if (!isRecentJobPostingValue(candidate.publicationDate, maxAgeDays)) continue

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

export function deduplicateReadyResults(results: SearchRunResultItem[]): SearchRunResultItem[] {
  const byIdentity = new Map<string, SearchRunResultItem>()

  for (const result of results) {
    const key = searchRunResultIdentityKey(result)
    const existing = byIdentity.get(key)
    if (!existing || readyResultScore(result) > readyResultScore(existing)) {
      byIdentity.set(key, result)
    }
  }

  return Array.from(byIdentity.values())
}

function fitScoreForIndex(index: number, total: number): SearchRunResultItem['fitScore'] {
  if (total <= 1) return 'High'
  const highCutoff = Math.max(1, Math.ceil(total / 3))
  const mediumCutoff = Math.max(highCutoff + (total > 2 ? 1 : 0), Math.ceil((total * 2) / 3))
  if (index < highCutoff) return 'High'
  if (index < mediumCutoff) return 'Medium'
  return 'Low'
}

export function rankSearchRunResults(results: SearchRunResultItem[]): SearchRunResultItem[] {
  const sorted = [...results].sort((a, b) => {
    const scoreDelta = readyResultScore(b) - readyResultScore(a)
    if (scoreDelta !== 0) return scoreDelta

    const relevanceDelta = (b.relevance || 0) - (a.relevance || 0)
    if (relevanceDelta !== 0) return relevanceDelta

    return String(a.title || '').localeCompare(String(b.title || ''))
  })

  return sorted.map((item, index) => ({
    ...item,
    queuePosition: index + 1,
    fitScore: fitScoreForIndex(index, sorted.length),
  }))
}

export function extractedTitleLooksValid(title: string | undefined | null): boolean {
  const normalized = String(title || '').trim()
  if (!normalized) return false
  return !titleLooksLikeListingPage(normalized)
}
