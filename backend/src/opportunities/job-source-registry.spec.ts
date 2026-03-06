import { getActiveDiscoveryDomains, getAllowedDomains } from './job-source-registry'

describe('job source registry', () => {
  it('keeps broad source metadata while limiting active discovery to ATS domains', () => {
    const allowedDomains = getAllowedDomains('global')
    const activeDiscoveryDomains = getActiveDiscoveryDomains('global')

    expect(allowedDomains).toEqual(
      expect.arrayContaining(['linkedin.com', 'indeed.com', 'glassdoor.com', 'boards.greenhouse.io', 'jobs.lever.co', 'ashbyhq.com']),
    )

    expect(activeDiscoveryDomains).toEqual(
      expect.arrayContaining(['greenhouse.io', 'boards.greenhouse.io', 'lever.co', 'jobs.lever.co', 'api.lever.co', 'ashbyhq.com']),
    )
    expect(activeDiscoveryDomains).not.toEqual(expect.arrayContaining(['linkedin.com', 'indeed.com', 'glassdoor.com']))
  })
})
