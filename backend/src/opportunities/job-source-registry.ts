export type JobSourceScope = 'global' | 'regional'
export type JobSourceType = 'job_board' | 'ats' | 'company_careers'

export type JobSourceProfile = {
  id: string
  name: string
  type: JobSourceType
  verified: boolean
  domains: string[]
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
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'indeed',
    name: 'Indeed',
    type: 'job_board',
    verified: true,
    domains: ['indeed.com'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'glassdoor',
    name: 'Glassdoor',
    type: 'job_board',
    verified: true,
    domains: ['glassdoor.com'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse',
    type: 'ats',
    verified: true,
    domains: ['greenhouse.io', 'boards.greenhouse.io'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'lever',
    name: 'Lever',
    type: 'ats',
    verified: true,
    domains: ['lever.co', 'jobs.lever.co', 'api.lever.co'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'ashby',
    name: 'Ashby',
    type: 'ats',
    verified: true,
    domains: ['ashbyhq.com'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'jobberman',
    name: 'Jobberman',
    type: 'job_board',
    verified: true,
    domains: ['jobberman.com'],
    includeInGlobal: false,
    includeInRegional: true,
  },
  {
    id: 'myjobmag',
    name: 'MyJobMag',
    type: 'job_board',
    verified: true,
    domains: ['myjobmag.com'],
    includeInGlobal: false,
    includeInRegional: true,
  },
  {
    id: 'djinni',
    name: 'Djinni',
    type: 'job_board',
    verified: true,
    domains: ['djinni.co'],
    includeInGlobal: false,
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
    .filter((source) => source.type === 'ats')
    .flatMap((source) => source.domains)

  return Array.from(new Set(domains.map((domain) => domain.toLowerCase().replace(/^www\./, ''))))
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
