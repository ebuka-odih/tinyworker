import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { filterAndDeduplicateDiscoveredCandidates, normalizeDiscoveryQuery } from './job-search-candidate.utils'
import { resolveSourceMeta } from './job-source-registry'

type ValyuSearchResult = {
  title?: string
  url?: string
  snippet?: string
  content?: string
  description?: string
  source?: string
  relevance_score?: number
  score?: number
}

type ValyuSearchResponse = {
  results?: ValyuSearchResult[]
}

type JobSearchInput = {
  query: string
  countryCode?: string
  maxNumResults: number
  includedSources?: string[]
}

export type ValyuDiscoveredCandidate = {
  id: string
  title: string
  url: string
  snippet: string
  relevance: number
  sourceLabel?: string
  sourceName: string
  sourceDomain: string
  sourceType: 'job_board' | 'ats' | 'company_careers'
  sourceVerified: boolean
}

@Injectable()
export class ValyuSearchService {
  private readonly apiUrl = process.env.VALYU_API_URL || 'https://api.valyu.ai/v1/search'
  private readonly timeoutMs = Number(process.env.VALYU_API_TIMEOUT_MS || 20000)

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
          sourceLabel: item.source || undefined,
          sourceName: sourceMeta.sourceName,
          sourceDomain: sourceMeta.sourceDomain,
          sourceType: sourceMeta.sourceType,
          sourceVerified: sourceMeta.sourceVerified,
        })
      })

      const filtered = filterAndDeduplicateDiscoveredCandidates(aggregated)
      if (filtered.length >= input.maxNumResults) {
        return filtered
      }
    }

    return filterAndDeduplicateDiscoveredCandidates(aggregated)
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

  private buildQueryVariants(input: JobSearchInput): string[] {
    const original = String(input.query || '').trim()
    const normalized = normalizeDiscoveryQuery(original)
    const variants = new Set<string>()

    if (original) variants.add(original)
    if (normalized && normalized !== original) variants.add(normalized)

    const base = normalized || original
    if (base) {
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
    }

    return Array.from(variants).filter(Boolean)
  }

  private hasSource(includedSources: string[] | undefined, domain: string): boolean {
    if (!includedSources?.length) return true
    return includedSources.some((item) => item === domain)
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
}
