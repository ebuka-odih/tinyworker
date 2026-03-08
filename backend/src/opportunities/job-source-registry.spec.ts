import {
  getActiveDiscoveryDomains,
  getAllowedDomains,
  getCuratedSourceProfiles,
  isCuratedJobSourceDomain,
  isHeavyJobSiteDomain,
} from './job-source-registry'

describe('job source registry', () => {
  it('keeps broad source metadata while limiting active discovery to approved high-signal domains', () => {
    const allowedDomains = getAllowedDomains('global')
    const activeDiscoveryDomains = getActiveDiscoveryDomains('global')

    expect(allowedDomains).toEqual(
      expect.arrayContaining([
        'weworkremotely.com',
        'remotive.com',
        'remote.co',
        'remoteok.com',
        'justremote.co',
        'workingnomads.com',
        'jobspresso.co',
        'dailyremote.com',
        'remoteafrica.io',
        'linkedin.com',
        'indeed.com',
        'glassdoor.com',
        'boards.greenhouse.io',
        'jobs.lever.co',
        'ashbyhq.com',
        'djinni.co',
      ]),
    )

    expect(activeDiscoveryDomains).toEqual(
      expect.arrayContaining([
        'weworkremotely.com',
        'remotive.com',
        'remote.co',
        'remoteok.com',
        'justremote.co',
        'workingnomads.com',
        'jobspresso.co',
        'dailyremote.com',
        'remoteafrica.io',
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

  it('identifies curated job-source domains for the default search mode', () => {
    expect(isCuratedJobSourceDomain('weworkremotely.com')).toBe(true)
    expect(isCuratedJobSourceDomain('remotive.com')).toBe(true)
    expect(isCuratedJobSourceDomain('remote.co')).toBe(true)
    expect(isCuratedJobSourceDomain('remoteafrica.io')).toBe(true)
    expect(isCuratedJobSourceDomain('boards.greenhouse.io')).toBe(false)
    expect(isCuratedJobSourceDomain('jobs.lever.co')).toBe(false)
    expect(isCuratedJobSourceDomain('linkedin.com')).toBe(false)
    expect(isCuratedJobSourceDomain('indeed.com')).toBe(false)
  })

  it('exposes curated-source metadata without shrinking the current source set', () => {
    const curated = getCuratedSourceProfiles('global')
    const allowedDomains = getAllowedDomains('global', 'curated')
    const activeDiscoveryDomains = getActiveDiscoveryDomains('global', 'curated')

    expect(curated).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'weworkremotely',
          queueTier: 'fast',
          preferredMode: 'search_page',
          trustScore: 9,
        }),
        expect.objectContaining({
          id: 'remoteafrica',
          queueTier: 'fast',
          preferredMode: 'search_page',
          searchUrlTemplate: expect.stringContaining('remoteafrica.io/jobs'),
        }),
      ]),
    )

    expect(allowedDomains).toEqual(
      expect.arrayContaining([
        'weworkremotely.com',
        'remotive.com',
        'remote.co',
        'remoteok.com',
        'justremote.co',
        'workingnomads.com',
        'jobspresso.co',
        'dailyremote.com',
        'remoteafrica.io',
      ]),
    )
    expect(allowedDomains).not.toEqual(expect.arrayContaining(['linkedin.com', 'indeed.com', 'glassdoor.com', 'boards.greenhouse.io']))
    expect(activeDiscoveryDomains).toEqual(
      expect.arrayContaining([
        'weworkremotely.com',
        'remotive.com',
        'remote.co',
        'remoteok.com',
        'justremote.co',
        'workingnomads.com',
        'jobspresso.co',
        'dailyremote.com',
        'remoteafrica.io',
      ]),
    )
  })
})
