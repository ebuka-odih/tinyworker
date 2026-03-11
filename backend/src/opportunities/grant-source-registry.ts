export type GrantSourceScope = 'global' | 'regional'
export type GrantSourceType = 'job_board' | 'company_careers'

export type GrantSourceProfile = {
  id: string
  name: string
  type: GrantSourceType
  verified: boolean
  scoutOnly?: boolean
  domains: string[]
  includeInGlobal: boolean
  includeInRegional: boolean
}

export type ResolvedGrantSourceMeta = {
  sourceName: string
  sourceDomain: string
  sourceType: GrantSourceType
  sourceVerified: boolean
  scoutOnly: boolean
}

const DEFAULT_SOURCE: ResolvedGrantSourceMeta = {
  sourceName: 'Grant Web Source',
  sourceDomain: 'web',
  sourceType: 'job_board',
  sourceVerified: false,
  scoutOnly: false,
}

export const GRANT_SOURCE_PROFILES: GrantSourceProfile[] = [
  {
    id: 'grantsgov',
    name: 'Grants.gov',
    type: 'company_careers',
    verified: true,
    domains: ['grants.gov'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'wellcome',
    name: 'Wellcome',
    type: 'company_careers',
    verified: true,
    domains: ['wellcome.org'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'echoinggreen',
    name: 'Echoing Green',
    type: 'company_careers',
    verified: true,
    domains: ['echoinggreen.org'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'eu-funding',
    name: 'EU Funding & Tenders',
    type: 'company_careers',
    verified: true,
    domains: ['ec.europa.eu', 'europa.eu'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'fundsforngos',
    name: 'Funds for NGOs',
    type: 'job_board',
    verified: true,
    scoutOnly: true,
    domains: ['fundsforngos.org', 'www2.fundsforngos.org'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'opportunitydesk',
    name: 'Opportunity Desk',
    type: 'job_board',
    verified: true,
    scoutOnly: true,
    domains: ['opportunitydesk.org'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'africaopportunities',
    name: 'Africa Opportunities',
    type: 'job_board',
    verified: true,
    scoutOnly: true,
    domains: ['africaopportunities.com'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'youthopportunitieshub',
    name: 'Youth Opportunities Hub',
    type: 'job_board',
    verified: true,
    scoutOnly: true,
    domains: ['youthopportunitieshub.com'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'globalgrants',
    name: 'Global Grants',
    type: 'job_board',
    verified: true,
    scoutOnly: true,
    domains: ['globalgrants.info'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'scholarshippositions',
    name: 'Scholarship Positions',
    type: 'job_board',
    verified: true,
    scoutOnly: true,
    domains: ['scholarshippositions.com'],
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

export function getActiveGrantDiscoveryDomains(scope: GrantSourceScope): string[] {
  const domains = GRANT_SOURCE_PROFILES.filter((source) =>
    scope === 'regional' ? source.includeInRegional : source.includeInGlobal,
  ).flatMap((source) => source.domains)

  return Array.from(new Set(domains.map((domain) => toHost(domain))))
}

export function resolveGrantSourceMeta(link?: string | null, sourceLabel?: string | null): ResolvedGrantSourceMeta {
  const host = link ? toHost(link) : ''
  const normalizedLabel = String(sourceLabel || '').trim().toLowerCase()

  const fromHost = GRANT_SOURCE_PROFILES.find((source) =>
    source.domains.some((domain) => host === toHost(domain) || host.endsWith(`.${toHost(domain)}`)),
  )
  if (fromHost) {
    return {
      sourceName: fromHost.name,
      sourceDomain: host || toHost(fromHost.domains[0]),
      sourceType: fromHost.type,
      sourceVerified: fromHost.verified,
      scoutOnly: Boolean(fromHost.scoutOnly),
    }
  }

  const fromLabel = GRANT_SOURCE_PROFILES.find((source) => source.name.toLowerCase() === normalizedLabel)
  if (fromLabel) {
    return {
      sourceName: fromLabel.name,
      sourceDomain: host || toHost(fromLabel.domains[0]),
      sourceType: fromLabel.type,
      sourceVerified: fromLabel.verified,
      scoutOnly: Boolean(fromLabel.scoutOnly),
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
