import { createHash } from 'node:crypto'
import { normalizeDiscoveryQuery } from './job-search-candidate.utils'
import type { JobSourceScope } from './job-source-registry'
import type { SearchRunResultItem } from './job-search-run.store'

type JobSearchCacheIdentityInput = {
  query: string
  countryCode?: string
  sourceScope: JobSourceScope
  remote?: boolean
  visaSponsorship?: boolean
}

export type JobSearchCacheIdentity = {
  queryHash: string
  intentHash: string
  normalizedQuery: string
  normalizedIntent: string
}

const LOCATION_PATTERN =
  /\b(?:jobs?\s+in|in)\s+.+?(?=(?:\bwith\s+visa\s+sponsorship\b|\bvisa\s+sponsorship\b|\bremote\b|$))/gi
const FILLER_TOKEN_PATTERN =
  /\b(and|at|for|from|job|jobs|opportunities|opportunity|position|positions|role|roles|the)\b/g

function hashKey(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function normalizeRolePhrase(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(FILLER_TOKEN_PATTERN, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeSearchIntentQuery(query: string): string {
  const normalized = normalizeDiscoveryQuery(query)
    .toLowerCase()
    .replace(LOCATION_PATTERN, ' ')
    .replace(/\bwith\s+visa\s+sponsorship\b/gi, ' ')
    .replace(/\bvisa\s+sponsorship\b/gi, ' ')
    .replace(/\bremote\b/gi, ' ')
    .replace(/\|/g, ' or ')
    .replace(/\s+/g, ' ')
    .trim()

  const phrases = normalized
    .split(/\s+\bor\b\s+/)
    .map((item) => normalizeRolePhrase(item))
    .filter(Boolean)

  if (!phrases.length) {
    return normalizeRolePhrase(normalized)
  }

  return Array.from(new Set(phrases)).sort().join(' or ')
}

export function buildJobSearchCacheIdentity(input: JobSearchCacheIdentityInput): JobSearchCacheIdentity {
  const normalizedQuery = String(input.query || '').trim()
  const normalizedIntent = JSON.stringify({
    query: normalizeSearchIntentQuery(normalizedQuery),
    countryCode: String(input.countryCode || '').trim().toUpperCase(),
    sourceScope: input.sourceScope || 'global',
    remote: Boolean(input.remote),
    visaSponsorship: Boolean(input.visaSponsorship),
  })

  const exactIdentity = JSON.stringify({
    query: normalizedQuery,
    countryCode: String(input.countryCode || '').trim().toUpperCase(),
    sourceScope: input.sourceScope || 'global',
    remote: Boolean(input.remote),
    visaSponsorship: Boolean(input.visaSponsorship),
  })

  return {
    queryHash: hashKey(exactIdentity),
    intentHash: hashKey(normalizedIntent),
    normalizedQuery,
    normalizedIntent,
  }
}

export function sliceCachedReadyResults(results: SearchRunResultItem[], maxNumResults: number): SearchRunResultItem[] {
  return results.slice(0, Math.max(1, maxNumResults)).map((item, index) => ({
    ...item,
    queueStatus: item.queueStatus === 'ready' || item.queueStatus === 'verified' ? item.queueStatus : 'ready',
    queuePosition: index + 1,
  }))
}
