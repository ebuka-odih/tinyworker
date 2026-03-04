import { Injectable, ServiceUnavailableException } from '@nestjs/common'

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
}

@Injectable()
export class ValyuSearchService {
  private readonly apiUrl = process.env.VALYU_API_URL || 'https://api.valyu.ai/v1/search'

  async searchJobs(input: JobSearchInput) {
    const apiKey = process.env.VALYU_API_KEY
    if (!apiKey) {
      throw new ServiceUnavailableException('VALYU_API_KEY is not configured')
    }

    const body = {
      query: input.query,
      search_type: 'web',
      max_num_results: input.maxNumResults,
      country_code: input.countryCode,
      category: 'job opportunities',
      response_length: 'short',
      fast_mode: true,
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new ServiceUnavailableException(`Valyu search failed (${response.status}): ${errorBody}`)
    }

    const payload = (await response.json()) as ValyuSearchResponse
    const rawResults = Array.isArray(payload.results) ? payload.results : []

    return rawResults.map((item, idx) => {
      const relevance = item.relevance_score ?? item.score ?? 0
      const fitScore = relevance >= 0.8 ? 'High' : relevance >= 0.6 ? 'Medium' : 'Low'
      const source = item.source || 'Valyu'
      return {
        id: `${Date.now()}-${idx}`,
        title: item.title || 'Untitled role',
        organization: source,
        location: input.countryCode || 'Global',
        fitScore,
        tags: ['Valyu', source],
        link: item.url || '#',
        status: 'new' as const,
        snippet: item.snippet || item.description || item.content || '',
        relevance,
      }
    })
  }
}
