import {
  getActiveDiscoveryDomains,
  getAllowedDomains,
  getCuratedSourceProfiles,
  isHeavyJobSiteDomain,
} from './job-source-registry'

describe('job source registry', () => {
  it('keeps broad source metadata while limiting active discovery to approved high-signal domains', () => {
    const allowedDomains = getAllowedDomains('global')
    const activeDiscoveryDomains = getActiveDiscoveryDomains('global')

    expect(allowedDomains).toEqual(
      expect.arrayContaining(['linkedin.com', 'indeed.com', 'glassdoor.com', 'boards.greenhouse.io', 'jobs.lever.co', 'ashbyhq.com', 'djinni.co']),
    )

    expect(activeDiscoveryDomains).toEqual(
      expect.arrayContaining([
        'linkedin.com',
        'indeed.com',
        'glassdoor.com',
        'greenhouse.io',
        'boards.greenhouse.io',
        'lever.co',
        'jobs.lever.co',
        'api.lever.co',
        'ashbyhq.com',
        'djinni.co',
      ]),
    )
    expect(allowedDomains).not.toEqual(expect.arrayContaining(['jobberman.com', 'myjobmag.com']))
  })

  it('marks heavy sites for proxy-backed stealth extraction', () => {
    expect(isHeavyJobSiteDomain('linkedin.com')).toBe(true)
    expect(isHeavyJobSiteDomain('www.indeed.com')).toBe(true)
    expect(isHeavyJobSiteDomain('glassdoor.com')).toBe(true)
    expect(isHeavyJobSiteDomain('jobs.lever.co')).toBe(false)
  })

  it('exposes curated-source metadata without shrinking the current source set', () => {
    const curated = getCuratedSourceProfiles('global')
    const allowedDomains = getAllowedDomains('global', 'curated')
    const activeDiscoveryDomains = getActiveDiscoveryDomains('global', 'curated')

    expect(curated).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'greenhouse',
          queueTier: 'fast',
          preferredMode: 'ats_direct',
          trustScore: 10,
        }),
        expect.objectContaining({
          id: 'djinni',
          queueTier: 'fast',
          preferredMode: 'search_page',
          searchUrlTemplate: expect.stringContaining('djinni.co/jobs'),
        }),
      ]),
    )

    expect(allowedDomains).toEqual(expect.arrayContaining(['boards.greenhouse.io', 'jobs.lever.co', 'ashbyhq.com', 'djinni.co']))
    expect(allowedDomains).not.toEqual(expect.arrayContaining(['linkedin.com', 'indeed.com', 'glassdoor.com']))
    expect(activeDiscoveryDomains).toEqual(expect.arrayContaining(['greenhouse.io', 'jobs.lever.co', 'ashbyhq.com', 'djinni.co']))
  })
})
