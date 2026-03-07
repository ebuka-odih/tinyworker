import { buildJobSearchCacheIdentity, normalizeSearchIntentQuery, sliceCachedReadyResults } from './job-search-cache.utils'
import { SearchRunResultItem } from './job-search-run.store'

describe('job search cache utils', () => {
  it('builds the same intent hash for reordered OR role queries with the same filters', () => {
    const first = buildJobSearchCacheIdentity({
      query: 'Platform Engineer OR Backend Engineer jobs in Germany remote',
      countryCode: 'DE',
      sourceScope: 'global',
      remote: true,
      visaSponsorship: false,
    })
    const second = buildJobSearchCacheIdentity({
      query: 'remote backend engineer OR platform engineer opportunities',
      countryCode: 'DE',
      sourceScope: 'global',
      remote: true,
      visaSponsorship: false,
    })

    expect(first.intentHash).toBe(second.intentHash)
    expect(first.queryHash).not.toBe(second.queryHash)
  })

  it('changes the intent hash when filters change', () => {
    const base = buildJobSearchCacheIdentity({
      query: 'Backend Engineer',
      countryCode: 'DE',
      sourceScope: 'global',
      remote: false,
      visaSponsorship: false,
    })
    const remote = buildJobSearchCacheIdentity({
      query: 'Backend Engineer remote',
      countryCode: 'DE',
      sourceScope: 'global',
      remote: true,
      visaSponsorship: false,
    })

    expect(base.intentHash).not.toBe(remote.intentHash)
  })

  it('keeps classic cache identity stable and splits curated mode into its own namespace', () => {
    const classicDefault = buildJobSearchCacheIdentity({
      query: 'Backend Engineer',
      countryCode: 'DE',
      sourceScope: 'global',
      remote: true,
      visaSponsorship: false,
    })
    const classicExplicit = buildJobSearchCacheIdentity({
      query: 'Backend Engineer',
      countryCode: 'DE',
      sourceScope: 'global',
      mode: 'classic',
      remote: true,
      visaSponsorship: false,
    })
    const curated = buildJobSearchCacheIdentity({
      query: 'Backend Engineer',
      countryCode: 'DE',
      sourceScope: 'global',
      mode: 'curated',
      remote: true,
      visaSponsorship: false,
    })

    expect(classicDefault.intentHash).toBe(classicExplicit.intentHash)
    expect(classicDefault.queryHash).toBe(classicExplicit.queryHash)
    expect(curated.intentHash).not.toBe(classicDefault.intentHash)
    expect(curated.queryHash).not.toBe(classicDefault.queryHash)
  })

  it('normalizes filler terms out of the intent query', () => {
    expect(normalizeSearchIntentQuery('backend engineer jobs in Germany with visa sponsorship remote')).toBe('backend engineer')
  })

  it('slices cached results and keeps them in ready state', () => {
    const base: SearchRunResultItem = {
      id: '1',
      title: 'Backend Engineer',
      organization: 'Acme',
      location: 'Remote',
      fitScore: 'High',
      tags: ['Greenhouse'],
      link: 'https://job-boards.greenhouse.io/acme/jobs/1',
      status: 'new',
      sourceName: 'Greenhouse',
      sourceDomain: 'job-boards.greenhouse.io',
      sourceType: 'ats',
      sourceVerified: true,
      queueStatus: 'ready',
    }

    const sliced = sliceCachedReadyResults([
      base,
      { ...base, id: '2', title: 'Platform Engineer', queuePosition: 2 },
    ], 1)

    expect(sliced).toHaveLength(1)
    expect(sliced[0]?.queueStatus).toBe('ready')
    expect(sliced[0]?.queuePosition).toBe(1)
  })
})
