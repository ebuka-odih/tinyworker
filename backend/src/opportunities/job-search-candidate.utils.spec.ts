import { SearchRunResultItem } from './job-search-run.store'
import {
  deduplicateReadyResults,
  deriveCandidateJobDetails,
  extractedTitleLooksValid,
  filterAndDeduplicateDiscoveredCandidates,
  isRecentJobPostingValue,
  normalizeDiscoveryQuery,
  rankSearchRunResults,
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

  it('filters out stale discovered candidates by publication date', () => {
    const filtered = filterAndDeduplicateDiscoveredCandidates(
      [
        {
          id: 'old-job',
          title: 'Staff Backend Engineer',
          url: 'https://jobs.lever.co/acme/old-role',
          snippet: 'Older role still indexed.',
          relevance: 0.8,
          publicationDate: '2024-01-01',
          sourceName: 'Lever',
          sourceDomain: 'jobs.lever.co',
          sourceType: 'ats',
          sourceVerified: true,
        },
        {
          id: 'fresh-job',
          title: 'Staff Backend Engineer',
          url: 'https://jobs.lever.co/acme/fresh-role',
          snippet: 'Recent role.',
          relevance: 0.85,
          publicationDate: new Date().toISOString().slice(0, 10),
          sourceName: 'Lever',
          sourceDomain: 'jobs.lever.co',
          sourceType: 'ats',
          sourceVerified: true,
        },
      ],
      { maxAgeDays: 21 },
    )

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.id).toBe('fresh-job')
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

  it('ranks richer ready results ahead of sparse ones and assigns relative fit tiers', () => {
    const sparse: SearchRunResultItem = {
      id: '1',
      title: 'Backend Engineer',
      organization: 'Acme',
      location: 'Remote',
      fitScore: 'Low',
      tags: ['Indeed'],
      link: 'https://www.indeed.com/viewjob?jk=abc123',
      status: 'new',
      sourceName: 'Indeed',
      sourceDomain: 'indeed.com',
      sourceType: 'job_board',
      sourceVerified: false,
      queueStatus: 'ready',
      relevance: 0.95,
      snippet: 'Work on backend systems.',
    }

    const rich: SearchRunResultItem = {
      id: '2',
      title: 'Platform Engineer',
      organization: 'Acme',
      location: 'Remote',
      fitScore: 'Low',
      tags: ['Greenhouse'],
      link: 'https://boards.greenhouse.io/acme/jobs/123',
      status: 'new',
      sourceName: 'Greenhouse',
      sourceDomain: 'greenhouse.io',
      sourceType: 'ats',
      sourceVerified: true,
      queueStatus: 'ready',
      relevance: 0.82,
      snippet: 'Own platform services.',
      salary: '$150k',
      matchReason: 'Strong match for backend platform work.',
      requirements: ['TypeScript', 'Distributed systems'],
      responsibilities: ['Build platform APIs'],
      benefits: ['Remote-first'],
    }

    const ranked = rankSearchRunResults([sparse, rich])
    expect(ranked[0]?.id).toBe('2')
    expect(ranked[0]?.fitScore).toBe('High')
    expect(ranked[1]?.fitScore).toBe('Medium')
  })

  it('rejects extracted listing titles as final job details', () => {
    expect(extractedTitleLooksValid('Flexible AI Engineer Jobs - Apply Today')).toBe(false)
    expect(extractedTitleLooksValid('Senior AI Engineer')).toBe(true)
  })

  it('normalizes generic any-location discovery queries', () => {
    expect(normalizeDiscoveryQuery('backend engineer jobs in Any location')).toBe('backend engineer')
    expect(normalizeDiscoveryQuery('backend engineer jobs in Berlin')).toBe('backend engineer in Berlin')
  })

  it('recognizes common recent age strings and rejects old ones', () => {
    expect(isRecentJobPostingValue('2 days ago', 21)).toBe(true)
    expect(isRecentJobPostingValue('13d', 21)).toBe(true)
    expect(isRecentJobPostingValue('2 years ago', 21)).toBe(false)
    expect(isRecentJobPostingValue('2y', 21)).toBe(false)
  })

  it('filters Djinni listing pages while allowing specific Djinni job details', () => {
    const filtered = filterAndDeduplicateDiscoveredCandidates([
      {
        id: 'djinni-listing',
        title: 'Python jobs in Ukraine',
        url: 'https://djinni.co/jobs/?primary_keyword=python',
        snippet: 'Search page',
        relevance: 0.7,
        sourceName: 'Djinni',
        sourceDomain: 'djinni.co',
        sourceType: 'job_board',
        sourceVerified: true,
      },
      {
        id: 'djinni-detail',
        title: 'Senior Backend Engineer',
        url: 'https://djinni.co/jobs/787654-senior-backend-engineer/',
        snippet: 'Fresh role · 2d',
        relevance: 0.9,
        sourceName: 'Djinni',
        sourceDomain: 'djinni.co',
        sourceType: 'job_board',
        sourceVerified: true,
      },
    ])

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.id).toBe('djinni-detail')
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
