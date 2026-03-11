import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import {
  filterAndDeduplicateDiscoveredCandidates,
  filterAndDeduplicateGrantCandidates,
  filterAndDeduplicateScholarshipCandidates,
  filterAndDeduplicateVisaCandidates,
  normalizeDiscoveryQuery,
} from './job-search-candidate.utils'
import { resolveGrantSourceMeta } from './grant-source-registry'
import type { JobSearchMode } from './job-search-mode'
import { resolveSourceMeta } from './job-source-registry'
import { resolveScholarshipSourceMeta } from './scholarship-source-registry'
import { resolveVisaSourceMeta } from './visa-source-registry'

type ValyuSearchResult = {
  title?: string
  url?: string
  snippet?: string
  content?: string
  description?: string
  source?: string
  relevance_score?: number
  score?: number
  publication_date?: string
}

type ValyuSearchResponse = {
  results?: ValyuSearchResult[]
}

type ValyuContentsSummaryEnvelope = {
  summary?: unknown
  result?: unknown
  data?: unknown
  output?: unknown
}

type ValyuContentsResult = {
  url?: string
  title?: string
  content?: string
  markdown?: string
  text?: string
  publication_date?: string
  published_at?: string
  summary?: unknown
  result?: unknown
  data?: unknown
  output?: unknown
}

type ValyuContentsResponse = {
  results?: ValyuContentsResult[]
  contents?: ValyuContentsResult[]
  data?: {
    results?: ValyuContentsResult[]
    contents?: ValyuContentsResult[]
  }
}

type JobSearchInput = {
  query: string
  countryCode?: string
  maxNumResults: number
  mode?: JobSearchMode
  includedSources?: string[]
}

type ScholarshipSearchInput = {
  query: string
  maxNumResults: number
  includedSources?: string[]
}

type GrantSearchInput = {
  query: string
  maxNumResults: number
  includedSources?: string[]
}

type VisaSearchInput = {
  query: string
  maxNumResults: number
  includedSources?: string[]
}

export type ValyuDiscoveredCandidate = {
  id: string
  title: string
  url: string
  snippet: string
  relevance: number
  publicationDate?: string
  sourceLabel?: string
  sourceName: string
  sourceDomain: string
  sourceType: 'job_board' | 'ats' | 'company_careers'
  sourceVerified: boolean
}

export type ValyuDiscoveredScholarshipCandidate = {
  id: string
  title: string
  url: string
  snippet: string
  relevance: number
  publicationDate?: string
  sourceLabel?: string
  sourceName: string
  sourceDomain: string
  sourceType: 'job_board' | 'company_careers'
  sourceVerified: boolean
}

export type ValyuDiscoveredGrantCandidate = {
  id: string
  title: string
  url: string
  snippet: string
  relevance: number
  publicationDate?: string
  sourceLabel?: string
  sourceName: string
  sourceDomain: string
  sourceType: 'job_board' | 'company_careers'
  sourceVerified: boolean
}

export type ValyuDiscoveredVisaCandidate = {
  id: string
  title: string
  url: string
  snippet: string
  relevance: number
  publicationDate?: string
  sourceLabel?: string
  sourceName: string
  sourceDomain: string
  sourceType: 'job_board' | 'company_careers'
  sourceVerified: boolean
}

export type ValyuExtractedJobContent = {
  title?: string
  company?: string
  location?: string
  salary?: string
  employment_type?: string
  work_mode?: string
  posted_date?: string
  match_reason?: string
  requirements?: string[]
  responsibilities?: string[]
  benefits?: string[]
  snippet?: string
  summary?: string
}

@Injectable()
export class ValyuSearchService {
  private readonly apiUrl = process.env.VALYU_API_URL || 'https://api.valyu.ai/v1/search'
  private readonly contentsApiUrl = process.env.VALYU_CONTENTS_API_URL || 'https://api.valyu.ai/v1/contents'
  private readonly timeoutMs = Number(process.env.VALYU_API_TIMEOUT_MS || 20000)
  private readonly contentsTimeoutMs = Number(process.env.VALYU_CONTENTS_TIMEOUT_MS || Math.max(this.timeoutMs, 25000))
  private readonly maxAgeDays = Math.max(1, Number(process.env.JOB_SEARCH_MAX_AGE_DAYS || 21))

  async discoverJobCandidates(input: JobSearchInput): Promise<ValyuDiscoveredCandidate[]> {
    const apiKey = process.env.VALYU_API_KEY
    if (!apiKey) {
      throw new ServiceUnavailableException('VALYU_API_KEY is not configured')
    }

    const variants = this.buildQueryVariants(input)
    const aggregated: ValyuDiscoveredCandidate[] = []

    for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
      const rawResults = await this.executeValyuSearch(apiKey, {
        query: variants[variantIndex],
        search_type: 'web',
        max_num_results: Math.min(20, Math.max(5, input.maxNumResults)),
        country_code: input.countryCode,
        category: 'job opportunities',
        response_length: 'short',
        fast_mode: true,
        start_date: this.formatDateDaysAgo(this.maxAgeDays),
        end_date: this.formatDateDaysAgo(0),
        included_sources: input.includedSources?.length ? input.includedSources : undefined,
      })

      rawResults.forEach((item, idx) => {
        const relevance = item.relevance_score ?? item.score ?? 0
        const url = item.url || ''
        if (!url) return
        const sourceMeta = resolveSourceMeta(url, item.source)
        aggregated.push({
          id: `${Date.now()}-${variantIndex}-${idx}`,
          title: item.title || 'Untitled role',
          url,
          snippet: item.snippet || item.description || item.content || '',
          relevance,
          publicationDate: item.publication_date || undefined,
          sourceLabel: item.source || undefined,
          sourceName: sourceMeta.sourceName,
          sourceDomain: sourceMeta.sourceDomain,
          sourceType: sourceMeta.sourceType,
          sourceVerified: sourceMeta.sourceVerified,
        })
      })

      const filtered = filterAndDeduplicateDiscoveredCandidates(aggregated, { maxAgeDays: this.maxAgeDays })
      if (filtered.length >= input.maxNumResults) {
        return filtered
      }
    }

    return filterAndDeduplicateDiscoveredCandidates(aggregated, { maxAgeDays: this.maxAgeDays })
  }

  async searchJobs(input: JobSearchInput) {
    const candidates = await this.discoverJobCandidates(input)
    return candidates.map((item) => {
      const fitScore = item.relevance >= 0.8 ? 'High' : item.relevance >= 0.6 ? 'Medium' : 'Low'
      return {
        id: item.id,
        title: item.title,
        organization: item.sourceName,
        location: input.countryCode || 'Global',
        fitScore,
        tags: [item.sourceName, item.sourceType === 'ats' ? 'ATS' : 'Job Board'],
        link: item.url || '#',
        status: 'new' as const,
        snippet: item.snippet,
        relevance: item.relevance,
        sourceName: item.sourceName,
        sourceDomain: item.sourceDomain,
        sourceType: item.sourceType,
        sourceVerified: item.sourceVerified,
        queueStatus: 'ready' as const,
      }
    })
  }

  async discoverScholarshipCandidates(input: ScholarshipSearchInput): Promise<ValyuDiscoveredScholarshipCandidate[]> {
    const apiKey = process.env.VALYU_API_KEY
    if (!apiKey) {
      throw new ServiceUnavailableException('VALYU_API_KEY is not configured')
    }

    const variants = this.buildScholarshipQueryVariants(input)
    const aggregated: ValyuDiscoveredScholarshipCandidate[] = []

    for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
      const rawResults = await this.executeValyuSearch(apiKey, {
        query: variants[variantIndex],
        search_type: 'web',
        max_num_results: Math.min(20, Math.max(5, input.maxNumResults)),
        category: 'scholarships',
        response_length: 'short',
        fast_mode: true,
        start_date: this.formatDateDaysAgo(365),
        end_date: this.formatDateDaysAgo(0),
        included_sources: input.includedSources?.length ? input.includedSources : undefined,
      })

      rawResults.forEach((item, idx) => {
        const relevance = item.relevance_score ?? item.score ?? 0
        const url = item.url || ''
        if (!url) return
        const sourceMeta = resolveScholarshipSourceMeta(url, item.source)
        aggregated.push({
          id: `${Date.now()}-sch-${variantIndex}-${idx}`,
          title: item.title || 'Untitled scholarship',
          url,
          snippet: item.snippet || item.description || item.content || '',
          relevance,
          publicationDate: item.publication_date || undefined,
          sourceLabel: item.source || undefined,
          sourceName: sourceMeta.sourceName,
          sourceDomain: sourceMeta.sourceDomain,
          sourceType: sourceMeta.sourceType,
          sourceVerified: sourceMeta.sourceVerified,
        })
      })

      const filtered = filterAndDeduplicateScholarshipCandidates(aggregated as ValyuDiscoveredCandidate[], {
        maxAgeDays: 365,
      }) as ValyuDiscoveredScholarshipCandidate[]
      if (filtered.length >= input.maxNumResults) {
        return filtered
      }
    }

    return filterAndDeduplicateScholarshipCandidates(aggregated as ValyuDiscoveredCandidate[], {
      maxAgeDays: 365,
    }) as ValyuDiscoveredScholarshipCandidate[]
  }

  async discoverGrantCandidates(input: GrantSearchInput): Promise<ValyuDiscoveredGrantCandidate[]> {
    const apiKey = process.env.VALYU_API_KEY
    if (!apiKey) {
      throw new ServiceUnavailableException('VALYU_API_KEY is not configured')
    }

    const variants = this.buildGrantQueryVariants(input)
    const aggregated: ValyuDiscoveredGrantCandidate[] = []

    for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
      const rawResults = await this.executeValyuSearch(apiKey, {
        query: variants[variantIndex],
        search_type: 'web',
        max_num_results: Math.min(20, Math.max(5, input.maxNumResults)),
        category: 'grants',
        response_length: 'short',
        fast_mode: true,
        start_date: this.formatDateDaysAgo(365),
        end_date: this.formatDateDaysAgo(0),
        included_sources: input.includedSources?.length ? input.includedSources : undefined,
      })

      rawResults.forEach((item, idx) => {
        const relevance = item.relevance_score ?? item.score ?? 0
        const url = item.url || ''
        if (!url) return
        const sourceMeta = resolveGrantSourceMeta(url, item.source)
        aggregated.push({
          id: `${Date.now()}-grant-${variantIndex}-${idx}`,
          title: item.title || 'Untitled grant',
          url,
          snippet: item.snippet || item.description || item.content || '',
          relevance,
          publicationDate: item.publication_date || undefined,
          sourceLabel: item.source || undefined,
          sourceName: sourceMeta.sourceName,
          sourceDomain: sourceMeta.sourceDomain,
          sourceType: sourceMeta.sourceType,
          sourceVerified: sourceMeta.sourceVerified,
        })
      })

      const filtered = filterAndDeduplicateGrantCandidates(aggregated as ValyuDiscoveredCandidate[], {
        maxAgeDays: 365,
      }) as ValyuDiscoveredGrantCandidate[]
      if (filtered.length >= input.maxNumResults) {
        return filtered
      }
    }

    return filterAndDeduplicateGrantCandidates(aggregated as ValyuDiscoveredCandidate[], {
      maxAgeDays: 365,
    }) as ValyuDiscoveredGrantCandidate[]
  }

  async discoverVisaCandidates(input: VisaSearchInput): Promise<ValyuDiscoveredVisaCandidate[]> {
    const apiKey = process.env.VALYU_API_KEY
    if (!apiKey) {
      throw new ServiceUnavailableException('VALYU_API_KEY is not configured')
    }

    const variants = this.buildVisaQueryVariants(input)
    const aggregated: ValyuDiscoveredVisaCandidate[] = []

    for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
      const rawResults = await this.executeValyuSearch(apiKey, {
        query: variants[variantIndex],
        search_type: 'web',
        max_num_results: Math.min(20, Math.max(5, input.maxNumResults)),
        category: 'visa',
        response_length: 'short',
        fast_mode: true,
        start_date: this.formatDateDaysAgo(365),
        end_date: this.formatDateDaysAgo(0),
        included_sources: input.includedSources?.length ? input.includedSources : undefined,
      })

      rawResults.forEach((item, idx) => {
        const relevance = item.relevance_score ?? item.score ?? 0
        const url = item.url || ''
        if (!url) return
        const sourceMeta = resolveVisaSourceMeta(url, item.source)
        aggregated.push({
          id: `${Date.now()}-visa-${variantIndex}-${idx}`,
          title: item.title || 'Untitled visa route',
          url,
          snippet: item.snippet || item.description || item.content || '',
          relevance,
          publicationDate: item.publication_date || undefined,
          sourceLabel: item.source || undefined,
          sourceName: sourceMeta.sourceName,
          sourceDomain: sourceMeta.sourceDomain,
          sourceType: sourceMeta.sourceType,
          sourceVerified: sourceMeta.sourceVerified,
        })
      })

      const filtered = filterAndDeduplicateVisaCandidates(aggregated as ValyuDiscoveredCandidate[], {
        maxAgeDays: 365,
      }) as ValyuDiscoveredVisaCandidate[]
      if (filtered.length >= input.maxNumResults) {
        return filtered
      }
    }

    return filterAndDeduplicateVisaCandidates(aggregated as ValyuDiscoveredCandidate[], {
      maxAgeDays: 365,
    }) as ValyuDiscoveredVisaCandidate[]
  }

  async extractJobPageContent(url: string, query: string): Promise<ValyuExtractedJobContent | null> {
    const apiKey = process.env.VALYU_API_KEY
    if (!apiKey) {
      throw new ServiceUnavailableException('VALYU_API_KEY is not configured')
    }

    const results = await this.executeValyuContents(apiKey, {
      urls: [url],
      extract_effort: 'high',
      include_images: false,
      response_length: 'short',
      summary: {
        type: 'json_schema',
        json_schema: {
          name: 'job_listing',
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Job title from the page.' },
              company: { type: 'string', description: 'Company or employer name.' },
              location: { type: 'string', description: 'Job location or region.' },
              salary: { type: 'string', description: 'Compensation details if available.' },
              employment_type: { type: 'string', description: 'Employment type such as full-time or contract.' },
              work_mode: { type: 'string', description: 'Remote, hybrid, onsite, or distributed.' },
              posted_date: { type: 'string', description: 'Posting date or relative recency if shown.' },
              match_reason: { type: 'string', description: `Briefly explain how this role matches the query: ${query}.` },
              summary: { type: 'string', description: 'Short summary of the role.' },
              snippet: { type: 'string', description: 'One concise snippet from the listing.' },
              requirements: { type: 'array', items: { type: 'string' } },
              responsibilities: { type: 'array', items: { type: 'string' } },
              benefits: { type: 'array', items: { type: 'string' } },
            },
            additionalProperties: false,
          },
        },
      },
    })

    const first = results[0]
    if (!first) return null

    const structured = this.pickStructuredJobContent(first.summary ?? first.result ?? first.data ?? first.output)
    if (structured) {
      return structured
    }

    const fallbackSnippet = this.safeText(first.content || first.markdown || first.text)
    return {
      title: this.safeText(first.title),
      posted_date: this.safeText(first.publication_date || first.published_at),
      summary: fallbackSnippet.slice(0, 600) || undefined,
      snippet: fallbackSnippet.slice(0, 280) || undefined,
    }
  }

  private buildQueryVariants(input: JobSearchInput): string[] {
    const original = String(input.query || '').trim()
    const normalized = normalizeDiscoveryQuery(original)
    const variants = new Set<string>()

    if (original) variants.add(original)
    if (normalized && normalized !== original) variants.add(normalized)

    const base = normalized || original
    if (base) {
      if (this.hasSource(input.includedSources, 'weworkremotely.com')) {
        variants.add(`site:weworkremotely.com/remote-jobs ${base}`)
      }
      if (this.hasSource(input.includedSources, 'remotive.com')) {
        variants.add(`site:remotive.com/remote-jobs ${base}`)
      }
      if (this.hasSource(input.includedSources, 'remote.co')) {
        variants.add(`site:remote.co/remote-jobs ${base}`)
      }
      if (this.hasSource(input.includedSources, 'remoteok.com')) {
        variants.add(`site:remoteok.com ${base}`)
      }
      if (this.hasSource(input.includedSources, 'justremote.co')) {
        variants.add(`site:justremote.co/remote-jobs ${base}`)
      }
      if (this.hasSource(input.includedSources, 'workingnomads.com')) {
        variants.add(`site:workingnomads.com/jobs ${base}`)
      }
      if (this.hasSource(input.includedSources, 'jobspresso.co')) {
        variants.add(`site:jobspresso.co/remote-work ${base}`)
      }
      if (this.hasSource(input.includedSources, 'dailyremote.com')) {
        variants.add(`site:dailyremote.com/remote-jobs ${base}`)
      }
      if (this.hasSource(input.includedSources, 'remoteafrica.io')) {
        variants.add(`site:remoteafrica.io/jobs ${base}`)
      }
      if (this.hasSource(input.includedSources, 'linkedin.com')) {
        variants.add(`site:linkedin.com/jobs/view ${base}`)
      }
      if (this.hasSource(input.includedSources, 'indeed.com')) {
        variants.add(`site:indeed.com/viewjob ${base}`)
      }
      if (this.hasSource(input.includedSources, 'glassdoor.com')) {
        variants.add(`site:glassdoor.com/job-listing ${base}`)
      }
      if (this.hasSource(input.includedSources, 'greenhouse.io') || this.hasSource(input.includedSources, 'boards.greenhouse.io')) {
        variants.add(`site:greenhouse.io ${base}`)
        variants.add(`site:boards.greenhouse.io ${base}`)
      }
      if (this.hasSource(input.includedSources, 'lever.co') || this.hasSource(input.includedSources, 'jobs.lever.co')) {
        variants.add(`site:jobs.lever.co ${base}`)
      }
      if (this.hasSource(input.includedSources, 'ashbyhq.com')) {
        variants.add(`site:ashbyhq.com ${base}`)
      }
      if (this.hasSource(input.includedSources, 'djinni.co')) {
        variants.add(`site:djinni.co/jobs ${base}`)
      }
    }

    return Array.from(variants).filter(Boolean)
  }

  private buildScholarshipQueryVariants(input: ScholarshipSearchInput): string[] {
    const normalized = normalizeDiscoveryQuery(String(input.query || '').trim())
      .replace(/\bjobs?\b/gi, ' ')
      .replace(/\brole\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const variants = new Set<string>()
    const base = normalized
    const siteScopedQuery = (domain: string, extra = '') => {
      if (!base) return
      variants.add(`site:${domain} ${base} scholarship ${extra}`.trim())
    }

    if (base) {
      if (this.hasSource(input.includedSources, 'scholarshipportal.com')) {
        siteScopedQuery('scholarshipportal.com')
      }
      if (this.hasSource(input.includedSources, 'mastersportal.com')) {
        siteScopedQuery('mastersportal.com/scholarships')
      }
      if (this.hasSource(input.includedSources, 'bachelorstudies.com')) {
        siteScopedQuery('bachelorstudies.com')
      }
      if (this.hasSource(input.includedSources, 'daad.de')) {
        siteScopedQuery('daad.de', '"scholarship"')
      }
      if (this.hasSource(input.includedSources, 'chevening.org')) {
        siteScopedQuery('chevening.org', '"scholarship"')
      }
      if (this.hasSource(input.includedSources, 'cscuk.fcdo.gov.uk')) {
        siteScopedQuery('cscuk.fcdo.gov.uk', '"scholarship"')
      }
      if (this.hasSource(input.includedSources, 'opportunitiesforafricans.com')) {
        siteScopedQuery('opportunitiesforafricans.com')
      }
    }

    return Array.from(variants).filter(Boolean)
  }

  private buildGrantQueryVariants(input: GrantSearchInput): string[] {
    const normalized = normalizeDiscoveryQuery(String(input.query || '').trim())
      .replace(/\bjobs?\b/gi, ' ')
      .replace(/\brole\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const variants = new Set<string>()
    const base = normalized
    const siteScopedQuery = (domain: string, extra = '') => {
      if (!base) return
      variants.add(`site:${domain} ${base} grant funding ${extra}`.trim())
    }

    if (base) {
      if (this.hasSource(input.includedSources, 'grants.gov')) {
        siteScopedQuery('grants.gov')
      }
      if (this.hasSource(input.includedSources, 'wellcome.org')) {
        siteScopedQuery('wellcome.org/grant-funding')
      }
      if (this.hasSource(input.includedSources, 'echoinggreen.org')) {
        siteScopedQuery('echoinggreen.org', '"fellowship"')
      }
      if (this.hasSource(input.includedSources, 'ec.europa.eu') || this.hasSource(input.includedSources, 'europa.eu')) {
        siteScopedQuery('ec.europa.eu', '"funding"')
        siteScopedQuery('europa.eu', '"grant"')
      }
      if (this.hasSource(input.includedSources, 'fundsforngos.org')) {
        siteScopedQuery('fundsforngos.org')
      }
      if (this.hasSource(input.includedSources, 'www2.fundsforngos.org')) {
        siteScopedQuery('www2.fundsforngos.org')
      }
      if (this.hasSource(input.includedSources, 'opportunitydesk.org')) {
        siteScopedQuery('opportunitydesk.org')
      }
      if (this.hasSource(input.includedSources, 'africaopportunities.com')) {
        siteScopedQuery('africaopportunities.com')
      }
      if (this.hasSource(input.includedSources, 'youthopportunitieshub.com')) {
        siteScopedQuery('youthopportunitieshub.com')
      }
      if (this.hasSource(input.includedSources, 'globalgrants.info')) {
        siteScopedQuery('globalgrants.info')
      }
      if (this.hasSource(input.includedSources, 'scholarshippositions.com')) {
        siteScopedQuery('scholarshippositions.com')
      }
    }

    return Array.from(variants).filter(Boolean)
  }

  private buildVisaQueryVariants(input: VisaSearchInput): string[] {
    const normalized = String(input.query || '')
      .replace(/\s+/g, ' ')
      .trim()
    const variants = new Set<string>()
    const base = normalized
    const siteScopedQuery = (domain: string, extra = '') => {
      if (!base) return
      variants.add(`site:${domain} ${base} visa requirements ${extra}`.trim())
    }

    if (base) {
      if (this.hasSource(input.includedSources, 'canada.ca')) {
        siteScopedQuery('canada.ca')
      }
      if (this.hasSource(input.includedSources, 'gov.uk')) {
        siteScopedQuery('gov.uk')
      }
      if (this.hasSource(input.includedSources, 'make-it-in-germany.com')) {
        siteScopedQuery('make-it-in-germany.com', '"visa"')
      }
      if (this.hasSource(input.includedSources, 'ind.nl')) {
        siteScopedQuery('ind.nl', '"residence permit"')
      }
    }

    return Array.from(variants).filter(Boolean)
  }

  private hasSource(includedSources: string[] | undefined, domain: string): boolean {
    if (!includedSources?.length) return true
    return includedSources.some((item) => item === domain)
  }

  private formatDateDaysAgo(daysAgo: number): string {
    const date = new Date()
    date.setUTCHours(0, 0, 0, 0)
    date.setUTCDate(date.getUTCDate() - Math.max(0, daysAgo))
    return date.toISOString().slice(0, 10)
  }

  private async executeValyuSearch(apiKey: string, body: Record<string, unknown>): Promise<ValyuSearchResult[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    let response: Response
    try {
      response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException(`Valyu search timed out after ${this.timeoutMs}ms`)
      }

      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new ServiceUnavailableException(`Valyu search request failed: ${message}`)
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      const errorBody = await response.text()
      throw new ServiceUnavailableException(`Valyu search failed (${response.status}): ${errorBody}`)
    }

    const payload = (await response.json()) as ValyuSearchResponse
    return Array.isArray(payload.results) ? payload.results : []
  }

  private async executeValyuContents(apiKey: string, body: Record<string, unknown>): Promise<ValyuContentsResult[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.contentsTimeoutMs)

    let response: Response
    try {
      response = await fetch(this.contentsApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException(`Valyu contents extraction timed out after ${this.contentsTimeoutMs}ms`)
      }

      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new ServiceUnavailableException(`Valyu contents request failed: ${message}`)
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      const errorBody = await response.text()
      throw new ServiceUnavailableException(`Valyu contents extraction failed (${response.status}): ${errorBody}`)
    }

    const payload = (await response.json()) as ValyuContentsResponse
    if (Array.isArray(payload.results)) return payload.results
    if (Array.isArray(payload.contents)) return payload.contents
    if (Array.isArray(payload.data?.results)) return payload.data.results
    if (Array.isArray(payload.data?.contents)) return payload.data.contents
    return []
  }

  private pickStructuredJobContent(input: unknown): ValyuExtractedJobContent | null {
    if (!input) return null
    if (typeof input === 'string') {
      try {
        return this.pickStructuredJobContent(JSON.parse(input))
      } catch {
        return null
      }
    }
    if (Array.isArray(input)) {
      for (const item of input) {
        const parsed = this.pickStructuredJobContent(item)
        if (parsed) return parsed
      }
      return null
    }
    if (typeof input !== 'object') return null

    const record = input as ValyuExtractedJobContent & ValyuContentsSummaryEnvelope
    const hasSignals = ['title', 'company', 'location', 'salary', 'summary', 'snippet', 'requirements'].some((key) => key in record)
    if (hasSignals) {
      return {
        title: this.safeText(record.title),
        company: this.safeText(record.company),
        location: this.safeText(record.location),
        salary: this.safeText(record.salary),
        employment_type: this.safeText(record.employment_type),
        work_mode: this.safeText(record.work_mode),
        posted_date: this.safeText(record.posted_date),
        match_reason: this.safeText(record.match_reason),
        summary: this.safeText(record.summary),
        snippet: this.safeText(record.snippet),
        requirements: this.safeList(record.requirements),
        responsibilities: this.safeList(record.responsibilities),
        benefits: this.safeList(record.benefits),
      }
    }

    return (
      this.pickStructuredJobContent(record.summary) ||
      this.pickStructuredJobContent(record.result) ||
      this.pickStructuredJobContent(record.data) ||
      this.pickStructuredJobContent(record.output)
    )
  }

  private safeText(value: unknown): string {
    if (typeof value === 'string') return value.trim()
    return ''
  }

  private safeList(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .slice(0, 10)
  }
}
