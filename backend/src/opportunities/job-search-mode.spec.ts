import { getJobSearchFeatureFlags, resolveJobSearchMode } from './job-search-mode'

describe('job search mode', () => {
  it('defaults all curated feature flags to false', () => {
    expect(getJobSearchFeatureFlags({})).toEqual({
      curatedModeEnabled: false,
      sourceRouterEnabled: false,
      sourceSearchPageEnabled: false,
      sourceSecondaryQueueEnabled: false,
      sourceCrawlerEnabled: false,
    })
  })

  it('honors an explicit curated-mode request', () => {
    expect(resolveJobSearchMode('curated', {})).toBe('curated')
    expect(resolveJobSearchMode('curated', { JOB_CURATED_MODE_ENABLED: 'false' })).toBe('curated')
  })

  it('defaults to the global flag only when no explicit mode was requested', () => {
    expect(resolveJobSearchMode(undefined, {})).toBe('classic')
    expect(resolveJobSearchMode(undefined, { JOB_CURATED_MODE_ENABLED: 'true' })).toBe('curated')
    expect(resolveJobSearchMode('classic', { JOB_CURATED_MODE_ENABLED: 'true' })).toBe('classic')
  })
})
