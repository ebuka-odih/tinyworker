import { SearchRunResultItem } from './job-search-run.store'
import {
  deduplicateReadyResults,
  deriveCandidateJobDetails,
  extractedTitleLooksValid,
  filterAndDeduplicateDiscoveredCandidates,
  normalizeDiscoveryQuery,
} from './job-search-candidate.utils'

describe('job-search candidate utils', () => {
  it('filters out search and listing pages before TinyFish extraction', () => {
    const filtered = filterAndDeduplicateDiscoveredCandidates([
      {
        id: 'listing-page',
        title: 'Flexible AI Engineer Jobs - Apply Today to Work From Home',
        url: 'https://www.indeed.com/jobs?q=ai+engineer&l=Remote',
        snippet: 'Browse 5,034 AI Engineer job openings from Remote.',
        relevance: 0.95,
        sourceName: 'Indeed',
        sourceDomain: 'indeed.com',
        sourceType: 'job_board',
        sourceVerified: true,
      },
      {
        id: 'real-job',
        title: 'AI Engineer',
        url: 'https://www.indeed.com/viewjob?jk=abc123&utm_source=test',
        snippet: 'Build backend systems for AI workflows.',
        relevance: 0.88,
        sourceName: 'Indeed',
        sourceDomain: 'indeed.com',
        sourceType: 'job_board',
        sourceVerified: true,
      },
    ])

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.url).toBe('https://www.indeed.com/viewjob?jk=abc123')
    expect(filtered[0]?.title).toBe('AI Engineer')
  })

  it('deduplicates discovered candidates by canonical URL', () => {
    const filtered = filterAndDeduplicateDiscoveredCandidates([
      {
        id: 'a',
        title: 'AI Engineer',
        url: 'https://www.indeed.com/viewjob?jk=abc123&utm_source=linkedin',
        snippet: '',
        relevance: 0.8,
        sourceName: 'Indeed',
        sourceDomain: 'indeed.com',
        sourceType: 'job_board',
        sourceVerified: true,
      },
      {
        id: 'b',
        title: 'AI Engineer (Backend)',
        url: 'https://www.indeed.com/viewjob?jk=abc123&utm_medium=email',
        snippet: 'More detail',
        relevance: 0.82,
        sourceName: 'Indeed',
        sourceDomain: 'indeed.com',
        sourceType: 'job_board',
        sourceVerified: true,
      },
    ])

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.title).toBe('AI Engineer (Backend)')
    expect(filtered[0]?.url).toBe('https://www.indeed.com/viewjob?jk=abc123')
  })

  it('deduplicates final ready results by extracted title, organization, and location', () => {
    const primary: SearchRunResultItem = {
      id: '1',
      title: 'AI Engineer',
      organization: 'Acme',
      location: 'Remote',
      fitScore: 'High',
      tags: ['Indeed'],
      link: 'https://www.indeed.com/viewjob?jk=abc123',
      status: 'new',
      sourceName: 'Indeed',
      sourceDomain: 'indeed.com',
      sourceType: 'job_board',
      sourceVerified: true,
      queueStatus: 'ready',
      relevance: 0.9,
      salary: '$120k',
      requirements: ['TypeScript'],
    }

    const duplicate: SearchRunResultItem = {
      ...primary,
      id: '2',
      sourceName: 'Greenhouse',
      sourceDomain: 'greenhouse.io',
      sourceType: 'ats',
      sourceVerified: false,
      salary: undefined,
      requirements: [],
      link: 'https://boards.greenhouse.io/acme/jobs/123',
    }

    const deduped = deduplicateReadyResults([duplicate, primary])
    expect(deduped).toHaveLength(1)
    expect(deduped[0]?.id).toBe('1')
    expect(deduped[0]?.sourceName).toBe('Indeed')
  })

  it('rejects extracted listing titles as final job details', () => {
    expect(extractedTitleLooksValid('Flexible AI Engineer Jobs - Apply Today')).toBe(false)
    expect(extractedTitleLooksValid('Senior AI Engineer')).toBe(true)
  })

  it('normalizes generic any-location discovery queries', () => {
    expect(normalizeDiscoveryQuery('backend engineer jobs in Any location')).toBe('backend engineer')
    expect(normalizeDiscoveryQuery('backend engineer jobs in Berlin')).toBe('backend engineer in Berlin')
  })

  it('derives role and organization from ATS-style candidate titles', () => {
    expect(deriveCandidateJobDetails('Job Application for Staff Backend Engineer, AI Platform at Home Solutions')).toEqual({
      title: 'Staff Backend Engineer, AI Platform',
      organization: 'Home Solutions',
    })
    expect(deriveCandidateJobDetails('Mistral AI - Software Engineer, Backend (Paris)')).toEqual({
      title: 'Software Engineer, Backend (Paris)',
      organization: 'Mistral AI',
    })
  })
})
