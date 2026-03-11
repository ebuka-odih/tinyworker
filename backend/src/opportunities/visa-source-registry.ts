export type VisaSourceScope = 'global' | 'regional'
export type VisaSourceType = 'job_board' | 'company_careers'

export type VisaSourceProfile = {
  id: string
  name: string
  type: VisaSourceType
  verified: boolean
  domains: string[]
  includeInGlobal: boolean
  includeInRegional: boolean
}

export type ResolvedVisaSourceMeta = {
  sourceName: string
  sourceDomain: string
  sourceType: VisaSourceType
  sourceVerified: boolean
}

const DEFAULT_SOURCE: ResolvedVisaSourceMeta = {
  sourceName: 'Visa Web Source',
  sourceDomain: 'web',
  sourceType: 'company_careers',
  sourceVerified: false,
}

export const VISA_SOURCE_PROFILES: VisaSourceProfile[] = [
  {
    id: 'canada-ircc',
    name: 'Canada IRCC',
    type: 'company_careers',
    verified: true,
    domains: ['canada.ca'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'govuk',
    name: 'GOV.UK',
    type: 'company_careers',
    verified: true,
    domains: ['gov.uk'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'make-it-in-germany',
    name: 'Make it in Germany',
    type: 'company_careers',
    verified: true,
    domains: ['make-it-in-germany.com'],
    includeInGlobal: true,
    includeInRegional: true,
  },
  {
    id: 'ind',
    name: 'IND Netherlands',
    type: 'company_careers',
    verified: true,
    domains: ['ind.nl'],
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

export function getActiveVisaDiscoveryDomains(scope: VisaSourceScope): string[] {
  const domains = VISA_SOURCE_PROFILES.filter((source) =>
    scope === 'regional' ? source.includeInRegional : source.includeInGlobal,
  ).flatMap((source) => source.domains)

  return Array.from(new Set(domains.map((domain) => toHost(domain))))
}

export function resolveVisaSourceMeta(link?: string | null, sourceLabel?: string | null): ResolvedVisaSourceMeta {
  const host = link ? toHost(link) : ''
  const normalizedLabel = String(sourceLabel || '').trim().toLowerCase()

  const fromHost = VISA_SOURCE_PROFILES.find((source) =>
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

  const fromLabel = VISA_SOURCE_PROFILES.find((source) => source.name.toLowerCase() === normalizedLabel)
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
