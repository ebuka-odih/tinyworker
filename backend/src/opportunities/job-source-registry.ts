import type { JobSearchMode } from './job-search-mode'

export type JobSourceScope = 'global' | 'regional'
export type JobSourceType = 'job_board' | 'ats' | 'company_careers'
export type JobSourceQueueTier = 'fast' | 'secondary' | 'deep'
export type JobSourcePreferredMode = 'search_page' | 'detail_page' | 'ats_direct'

export type JobSourceProfile = {
  id: string
  name: string
  type: JobSourceType
  categories: string[]
  verified: boolean
  trustScore: number
  domains: string[]
  activeDiscovery: boolean
  heavySite: boolean
  includeInGlobal: boolean
  includeInRegional: boolean
  queueTier: JobSourceQueueTier
  preferredMode: JobSourcePreferredMode
  searchUrlTemplate?: string
  supportsPagination: boolean
  supportsRemoteFilter: boolean
  supportsLocationFilter: boolean
  supportsSalarySignals: boolean
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
    id: 'weworkremotely',
    name: 'We Work Remotely',
    type: 'job_board',
    categories: ['default_search', 'remote_board'],
    verified: true,
    trustScore: 9,
    domains: ['weworkremotely.com'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
    queueTier: 'fast',
    preferredMode: 'search_page',
    searchUrlTemplate: 'https://weworkremotely.com/remote-jobs/search?term={query}',
    supportsPagination: true,
    supportsRemoteFilter: true,
    supportsLocationFilter: false,
    supportsSalarySignals: false,
  },
  {
    id: 'remotive',
    name: 'Remotive',
    type: 'job_board',
    categories: ['default_search', 'remote_board'],
    verified: true,
    trustScore: 9,
    domains: ['remotive.com'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
    queueTier: 'fast',
    preferredMode: 'search_page',
    searchUrlTemplate: 'https://remotive.com/remote-jobs/search?search={query}',
    supportsPagination: true,
    supportsRemoteFilter: true,
    supportsLocationFilter: false,
    supportsSalarySignals: false,
  },
  {
    id: 'remote_co',
    name: 'Remote.co',
    type: 'job_board',
    categories: ['default_search', 'remote_board'],
    verified: true,
    trustScore: 9,
    domains: ['remote.co'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
    queueTier: 'fast',
    preferredMode: 'search_page',
    searchUrlTemplate: 'https://remote.co/remote-jobs/search/?search_keywords={query}',
    supportsPagination: true,
    supportsRemoteFilter: true,
    supportsLocationFilter: false,
    supportsSalarySignals: false,
  },
  {
    id: 'remoteok',
    name: 'Remote OK',
    type: 'job_board',
    categories: ['default_search', 'remote_board'],
    verified: true,
    trustScore: 8,
    domains: ['remoteok.com'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
    queueTier: 'fast',
    preferredMode: 'search_page',
    searchUrlTemplate: 'https://remoteok.com/remote-{query}-jobs',
    supportsPagination: true,
    supportsRemoteFilter: true,
    supportsLocationFilter: false,
    supportsSalarySignals: false,
  },
  {
    id: 'justremote',
    name: 'JustRemote',
    type: 'job_board',
    categories: ['default_search', 'remote_board'],
    verified: true,
    trustScore: 8,
    domains: ['justremote.co'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
    queueTier: 'fast',
    preferredMode: 'search_page',
    searchUrlTemplate: 'https://justremote.co/remote-jobs?q={query}',
    supportsPagination: true,
    supportsRemoteFilter: true,
    supportsLocationFilter: false,
    supportsSalarySignals: false,
  },
  {
    id: 'workingnomads',
    name: 'Working Nomads',
    type: 'job_board',
    categories: ['default_search', 'remote_board'],
    verified: true,
    trustScore: 8,
    domains: ['workingnomads.com'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
    queueTier: 'fast',
    preferredMode: 'search_page',
    searchUrlTemplate: 'https://www.workingnomads.com/jobs?q={query}',
    supportsPagination: true,
    supportsRemoteFilter: true,
    supportsLocationFilter: false,
    supportsSalarySignals: false,
  },
  {
    id: 'jobspresso',
    name: 'Jobspresso',
    type: 'job_board',
    categories: ['default_search', 'remote_board'],
    verified: true,
    trustScore: 8,
    domains: ['jobspresso.co'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
    queueTier: 'fast',
    preferredMode: 'search_page',
    searchUrlTemplate: 'https://jobspresso.co/remote-work/{query}-jobs/',
    supportsPagination: true,
    supportsRemoteFilter: true,
    supportsLocationFilter: false,
    supportsSalarySignals: false,
  },
  {
    id: 'dailyremote',
    name: 'DailyRemote',
    type: 'job_board',
    categories: ['default_search', 'remote_board'],
    verified: true,
    trustScore: 7,
    domains: ['dailyremote.com'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
    queueTier: 'fast',
    preferredMode: 'search_page',
    searchUrlTemplate: 'https://dailyremote.com/remote-jobs?q={query}',
    supportsPagination: true,
    supportsRemoteFilter: true,
    supportsLocationFilter: false,
    supportsSalarySignals: false,
  },
  {
    id: 'remoteafrica',
    name: 'RemoteAfrica',
    type: 'job_board',
    categories: ['default_search', 'remote_board'],
    verified: true,
    trustScore: 9,
    domains: ['remoteafrica.io'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
    queueTier: 'fast',
    preferredMode: 'search_page',
    searchUrlTemplate: 'https://remoteafrica.io/jobs?q={query}',
    supportsPagination: true,
    supportsRemoteFilter: true,
    supportsLocationFilter: false,
    supportsSalarySignals: false,
  },
  {
    id: 'linkedin_jobs',
    name: 'LinkedIn Jobs',
    type: 'job_board',
    categories: ['wide_search', 'hybrid_remote', 'professional_network'],
    verified: true,
    trustScore: 10,
    domains: ['linkedin.com'],
    activeDiscovery: true,
    heavySite: true,
    includeInGlobal: true,
    includeInRegional: true,
    queueTier: 'secondary',
    preferredMode: 'search_page',
    searchUrlTemplate: 'https://www.linkedin.com/jobs/search/?keywords={query}&f_WT=2',
    supportsPagination: true,
    supportsRemoteFilter: true,
    supportsLocationFilter: true,
    supportsSalarySignals: false,
  },
  {
    id: 'indeed',
    name: 'Indeed',
    type: 'job_board',
    categories: ['wide_search', 'hybrid', 'general_jobs'],
    verified: true,
    trustScore: 9,
    domains: ['indeed.com'],
    activeDiscovery: true,
    heavySite: true,
    includeInGlobal: true,
    includeInRegional: true,
    queueTier: 'secondary',
    preferredMode: 'search_page',
    searchUrlTemplate: 'https://www.indeed.com/jobs?q={query}&remotejob=1',
    supportsPagination: true,
    supportsRemoteFilter: true,
    supportsLocationFilter: true,
    supportsSalarySignals: true,
  },
  {
    id: 'glassdoor',
    name: 'Glassdoor',
    type: 'job_board',
    categories: ['wide_search', 'hybrid', 'salary_signals'],
    verified: true,
    trustScore: 9,
    domains: ['glassdoor.com'],
    activeDiscovery: true,
    heavySite: true,
    includeInGlobal: true,
    includeInRegional: true,
    queueTier: 'secondary',
    preferredMode: 'search_page',
    searchUrlTemplate: 'https://www.glassdoor.com/Job/jobs.htm?sc.keyword={query}',
    supportsPagination: true,
    supportsRemoteFilter: true,
    supportsLocationFilter: true,
    supportsSalarySignals: true,
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse',
    type: 'ats',
    categories: ['wide_search', 'ats', 'company_careers'],
    verified: true,
    trustScore: 10,
    domains: ['greenhouse.io', 'boards.greenhouse.io'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
    queueTier: 'fast',
    preferredMode: 'ats_direct',
    supportsPagination: true,
    supportsRemoteFilter: false,
    supportsLocationFilter: false,
    supportsSalarySignals: false,
  },
  {
    id: 'lever',
    name: 'Lever',
    type: 'ats',
    categories: ['wide_search', 'ats', 'company_careers'],
    verified: true,
    trustScore: 10,
    domains: ['lever.co', 'jobs.lever.co', 'api.lever.co'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
    queueTier: 'fast',
    preferredMode: 'ats_direct',
    supportsPagination: true,
    supportsRemoteFilter: false,
    supportsLocationFilter: false,
    supportsSalarySignals: false,
  },
  {
    id: 'ashby',
    name: 'Ashby',
    type: 'ats',
    categories: ['wide_search', 'ats', 'company_careers'],
    verified: true,
    trustScore: 9,
    domains: ['ashbyhq.com'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
    queueTier: 'fast',
    preferredMode: 'ats_direct',
    supportsPagination: true,
    supportsRemoteFilter: false,
    supportsLocationFilter: false,
    supportsSalarySignals: false,
  },
  {
    id: 'djinni',
    name: 'Djinni',
    type: 'job_board',
    categories: ['wide_search', 'remote', 'regional'],
    verified: true,
    trustScore: 9,
    domains: ['djinni.co'],
    activeDiscovery: true,
    heavySite: false,
    includeInGlobal: true,
    includeInRegional: true,
    queueTier: 'fast',
    preferredMode: 'search_page',
    searchUrlTemplate: 'https://djinni.co/jobs/?primary_keyword={query}',
    supportsPagination: true,
    supportsRemoteFilter: true,
    supportsLocationFilter: false,
    supportsSalarySignals: false,
  },
]

function toHost(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return value.toLowerCase().replace(/^www\./, '')
  }
}

export function isCuratedJobSourceDomain(domain?: string | null): boolean {
  const host = toHost(String(domain || '').trim())
  if (!host) return false

  return getCuratedSourceProfiles('global').some((source) =>
    source.domains.some((candidate) => host === toHost(candidate) || host.endsWith(`.${toHost(candidate)}`)),
  )
}

function supportsCuratedRouting(source: JobSourceProfile): boolean {
  return source.categories.includes('default_search') && (Boolean(source.searchUrlTemplate) || source.preferredMode === 'search_page')
}

export function getSourceProfiles(scope: JobSourceScope, mode: JobSearchMode = 'classic'): JobSourceProfile[] {
  return JOB_SOURCE_PROFILES.filter((source) => {
    const included = scope === 'regional' ? source.includeInRegional : source.includeInGlobal
    if (!included) return false
    if (mode !== 'curated') return true
    return supportsCuratedRouting(source)
  })
}

export function getCuratedSourceProfiles(scope: JobSourceScope): JobSourceProfile[] {
  return getSourceProfiles(scope, 'curated')
}

export function getAllowedDomains(scope: JobSourceScope, mode: JobSearchMode = 'classic'): string[] {
  const domains = getSourceProfiles(scope, mode).flatMap((source) => source.domains)
  return Array.from(new Set(domains.map((domain) => domain.toLowerCase().replace(/^www\./, ''))))
}

export function getActiveDiscoveryDomains(scope: JobSourceScope, mode: JobSearchMode = 'classic'): string[] {
  const domains = getSourceProfiles(scope, mode)
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
