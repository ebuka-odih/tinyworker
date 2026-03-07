export const JOB_SEARCH_MODES = ['classic', 'curated'] as const

export type JobSearchMode = (typeof JOB_SEARCH_MODES)[number]

export type JobSearchFeatureFlags = {
  curatedModeEnabled: boolean
  sourceRouterEnabled: boolean
  sourceSearchPageEnabled: boolean
  sourceSecondaryQueueEnabled: boolean
  sourceCrawlerEnabled: boolean
}

function readBooleanFlag(value: string | undefined, fallback = false): boolean {
  if (value == null || value === '') return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

export function getJobSearchFeatureFlags(
  env: Record<string, string | undefined> = process.env,
): JobSearchFeatureFlags {
  return {
    curatedModeEnabled: readBooleanFlag(env.JOB_CURATED_MODE_ENABLED, false),
    sourceRouterEnabled: readBooleanFlag(env.JOB_SOURCE_ROUTER_ENABLED, false),
    sourceSearchPageEnabled: readBooleanFlag(env.JOB_SOURCE_SEARCH_PAGE_ENABLED, false),
    sourceSecondaryQueueEnabled: readBooleanFlag(env.JOB_SOURCE_SECONDARY_QUEUE_ENABLED, false),
    sourceCrawlerEnabled: readBooleanFlag(env.JOB_SOURCE_CRAWLER_ENABLED, false),
  }
}

export function resolveJobSearchMode(
  requestedMode?: JobSearchMode | string | null,
  env: Record<string, string | undefined> = process.env,
): JobSearchMode {
  const normalized = String(requestedMode || '')
    .trim()
    .toLowerCase()

  if (normalized === 'curated') return 'curated'
  if (normalized === 'classic') return 'classic'

  return getJobSearchFeatureFlags(env).curatedModeEnabled ? 'curated' : 'classic'
}
