export type JobSourceScope = 'global' | 'regional'
export type JobSourceType = 'job_board' | 'ats' | 'company_careers'

export type JobSourceProfile = {
  id: string
  name: string
  type: JobSourceType
  verified: boolean
  domains: string[]
  activeDiscovery: boolean
  heavySite: boolean
  includeInGlobal: boolean
  includeInRegional: boolean
}

export type ResolvedSourceMeta = {
  sourceName: string
  sourceDomain: string
  sourceType: JobSourceType
  sourceVerified: boolean
}

const DEFAULT_FALLBACK_SOURCE: ResolvedSourceMeta = {
  sourceName: 'Verified Web Source',
  sourceDomain: 'web',
  sourceType: 'job_board',
  sourceVerified: false,
}

export const JOB_SOURCE_PROFILES: JobSourceProfile[] = [
  {
    id: 'linkedin_jobs',
    name: 'LinkedIn Jobs',
    type: 'job_board',
    verified: true,
    domains: ['linkedin.com'],
    activeDiscovery: true,
    heavySite: true,
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'indeed',
    name: 'Indeed',
    type: 'job_board',
    verified: true,
    domains: ['indeed.com'],
    activeDiscovery: true,
    heavySite: true,
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'glassdoor',
    name: 'Glassdoor',
    type: 'job_board',
    verified: true,
    domains: ['glassdoor.com'],
    activeDiscovery: true,
    heavySite: true,
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse',
    type: 'ats',
    verified: true,
    domains: ['greenhouse.io', 'boards.greenhouse.io'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'lever',
    name: 'Lever',
    type: 'ats',
    verified: true,
    domains: ['lever.co', 'jobs.lever.co', 'api.lever.co'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'ashby',
    name: 'Ashby',
    type: 'ats',
    verified: true,
    domains: ['ashbyhq.com'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'djinni',
    name: 'Djinni',
    type: 'job_board',
    verified: true,
    domains: ['djinni.co'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
  },
]

function toHost(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return value.toLowerCase().replace(/^www\./, '')
  }
}

export function getSourceProfiles(scope: JobSourceScope): JobSourceProfile[] {
  return JOB_SOURCE_PROFILES.filter((source) => (scope === 'regional' ? source.includeInRegional : source.includeInGlobal))
}

export function getAllowedDomains(scope: JobSourceScope): string[] {
  const domains = getSourceProfiles(scope).flatMap((source) => source.domains)
  return Array.from(new Set(domains.map((domain) => domain.toLowerCase().replace(/^www\./, ''))))
}

export function getActiveDiscoveryDomains(scope: JobSourceScope): string[] {
  const domains = getSourceProfiles(scope)
    .filter((source) => source.activeDiscovery)
    .flatMap((source) => source.domains)

  return Array.from(new Set(domains.map((domain) => domain.toLowerCase().replace(/^www\./, ''))))
}

export function isHeavyJobSiteDomain(domain?: string | null): boolean {
  const host = toHost(String(domain || '').trim())
  if (!host) return false
  return JOB_SOURCE_PROFILES.some(
    (source) =>
      source.heavySite &&
      source.domains.some((candidate) => host === toHost(candidate) || host.endsWith(`.${toHost(candidate)}`)),
  )
}

export function resolveSourceMeta(link?: string | null, sourceLabel?: string | null): ResolvedSourceMeta {
  const host = link ? toHost(link) : ''
  const normalizedLabel = String(sourceLabel || '').trim().toLowerCase()

  const fromHost = JOB_SOURCE_PROFILES.find((source) => source.domains.some((domain) => host === toHost(domain) || host.endsWith(`.${toHost(domain)}`)))
  if (fromHost) {
    return {
      sourceName: fromHost.name,
      sourceDomain: host || toHost(fromHost.domains[0]),
      sourceType: fromHost.type,
      sourceVerified: fromHost.verified,
    }
  }

  const fromLabel = JOB_SOURCE_PROFILES.find((source) => source.name.toLowerCase() === normalizedLabel)
  if (fromLabel) {
    return {
      sourceName: fromLabel.name,
      sourceDomain: host || toHost(fromLabel.domains[0]),
      sourceType: fromLabel.type,
      sourceVerified: fromLabel.verified,
    }
  }

  if (host) {
    return {
      ...DEFAULT_FALLBACK_SOURCE,
      sourceName: host,
      sourceDomain: host,
      sourceVerified: false,
    }
  }

  return DEFAULT_FALLBACK_SOURCE
}
