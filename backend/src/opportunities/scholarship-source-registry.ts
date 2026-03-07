export type ScholarshipSourceScope = 'global' | 'regional'
export type ScholarshipSourceType = 'job_board' | 'company_careers'

export type ScholarshipSourceProfile = {
  id: string
  name: string
  type: ScholarshipSourceType
  verified: boolean
  domains: string[]
  includeInGlobal: boolean
  includeInRegional: boolean
}

export type ResolvedScholarshipSourceMeta = {
  sourceName: string
  sourceDomain: string
  sourceType: ScholarshipSourceType
  sourceVerified: boolean
}

const DEFAULT_SOURCE: ResolvedScholarshipSourceMeta = {
  sourceName: 'Scholarship Web Source',
  sourceDomain: 'web',
  sourceType: 'job_board',
  sourceVerified: false,
}

export const SCHOLARSHIP_SOURCE_PROFILES: ScholarshipSourceProfile[] = [
  {
    id: 'scholarshipportal',
    name: 'ScholarshipPortal',
    type: 'job_board',
    verified: true,
    domains: ['scholarshipportal.com'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'mastersportal',
    name: 'MastersPortal',
    type: 'job_board',
    verified: true,
    domains: ['mastersportal.com'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'bachelorstudies',
    name: 'Bachelorstudies',
    type: 'job_board',
    verified: true,
    domains: ['bachelorstudies.com'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'daad',
    name: 'DAAD',
    type: 'company_careers',
    verified: true,
    domains: ['daad.de'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'chevening',
    name: 'Chevening',
    type: 'company_careers',
    verified: true,
    domains: ['chevening.org'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'commonwealth',
    name: 'Commonwealth Scholarships',
    type: 'company_careers',
    verified: true,
    domains: ['cscuk.fcdo.gov.uk'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'opportunitiesforafricans',
    name: 'Opportunities for Africans',
    type: 'job_board',
    verified: true,
    domains: ['opportunitiesforafricans.com'],
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

export function getActiveScholarshipDiscoveryDomains(scope: ScholarshipSourceScope): string[] {
  const domains = SCHOLARSHIP_SOURCE_PROFILES.filter((source) =>
    scope === 'regional' ? source.includeInRegional : source.includeInGlobal,
  ).flatMap((source) => source.domains)

  return Array.from(new Set(domains.map((domain) => toHost(domain))))
}

export function resolveScholarshipSourceMeta(link?: string | null, sourceLabel?: string | null): ResolvedScholarshipSourceMeta {
  const host = link ? toHost(link) : ''
  const normalizedLabel = String(sourceLabel || '').trim().toLowerCase()

  const fromHost = SCHOLARSHIP_SOURCE_PROFILES.find((source) =>
    source.domains.some((domain) => host === toHost(domain) || host.endsWith(`.${toHost(domain)}`)),
  )
  if (fromHost) {
    return {
      sourceName: fromHost.name,
      sourceDomain: host || toHost(fromHost.domains[0]),
      sourceType: fromHost.type,
      sourceVerified: fromHost.verified,
    }
  }

  const fromLabel = SCHOLARSHIP_SOURCE_PROFILES.find((source) => source.name.toLowerCase() === normalizedLabel)
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
      ...DEFAULT_SOURCE,
      sourceName: host,
      sourceDomain: host,
    }
  }

  return DEFAULT_SOURCE
}
