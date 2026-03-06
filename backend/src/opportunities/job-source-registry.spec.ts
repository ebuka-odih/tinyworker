import { getActiveDiscoveryDomains, getAllowedDomains, isHeavyJobSiteDomain } from './job-source-registry'

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
})
