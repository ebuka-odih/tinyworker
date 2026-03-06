import { SearchCacheState, SearchResult, TimelineItem } from '../types';

export type SearchSourceScope = 'global' | 'regional';

export type JobSearchIntakeData = {
  roles?: string[];
  location?: string;
  visaSponsorship?: boolean;
  remote?: boolean;
  sourceScope?: SearchSourceScope;
  expandSearch?: boolean;
  strictMatching?: boolean;
};

export type PersistedSearchStatus = 'running' | 'paused' | 'completed' | 'error';
export type PersistedSearchPhase = 'initializing' | 'streaming' | 'background-monitoring' | 'completed' | 'error';
export type PersistedSearchTab = 'all' | 'shortlisted' | 'saved';

export type PersistedSearchSession = {
  version: 1;
  sessionId: string;
  formData: JobSearchIntakeData;
  status: PersistedSearchStatus;
  searchPhase: PersistedSearchPhase;
  elapsedTime: number;
  timeline: TimelineItem[];
  results: SearchResult[];
  activeTab: PersistedSearchTab;
  runId: string | null;
  cache: SearchCacheState | null;
  startedAt: number | null;
  lastSequence: number;
  updatedAt: number;
};

export type RecentSearchSummary = {
  sessionId: string;
  formData: JobSearchIntakeData;
  status: PersistedSearchStatus;
  updatedAt: number;
  runId: string | null;
  counts: {
    ready: number;
    failed: number;
    queued: number;
  };
};

const STORAGE_PREFIX = 'tinyworker:search-session:';
const DEFAULT_RECENT_SEARCH_LIMIT = 12;

function getStorageKey(userId: string, sessionId: string): string {
  return `${STORAGE_PREFIX}${userId}:${sessionId}`;
}

function getStoragePrefix(userId: string): string {
  return `${STORAGE_PREFIX}${userId}:`;
}

function hasSearchCriteria(formData: JobSearchIntakeData | null | undefined): boolean {
  if (!formData) return false;
  return (
    Boolean(formData.location) ||
    Boolean(formData.remote) ||
    Boolean(formData.visaSponsorship) ||
    (Array.isArray(formData.roles) && formData.roles.length > 0)
  );
}

function countResults(results: SearchResult[]) {
  return results.reduce(
    (acc, item) => {
      if (item.queueStatus === 'failed') {
        acc.failed += 1;
      } else if (item.queueStatus === 'queued' || item.queueStatus === 'extracting') {
        acc.queued += 1;
      } else {
        acc.ready += 1;
      }
      return acc;
    },
    { ready: 0, failed: 0, queued: 0 },
  );
}

function isValidPersistedSession(session: PersistedSearchSession | null | undefined): session is PersistedSearchSession {
  if (!session || session.version !== 1) return false;
  if (!String(session.sessionId || '').trim()) return false;
  if (!hasSearchCriteria(session.formData)) return false;
  return true;
}

function toRecentSearchSummary(session: PersistedSearchSession): RecentSearchSummary {
  return {
    sessionId: session.sessionId,
    formData: session.formData,
    status: session.status,
    updatedAt: Number(session.updatedAt || 0),
    runId: session.runId,
    counts: countResults(Array.isArray(session.results) ? session.results : []),
  };
}

export function readPersistedSearchSession(userId: string, sessionId: string): PersistedSearchSession | null {
  if (typeof window === 'undefined') return null;
  const safeUserId = String(userId || '').trim();
  const safeSessionId = String(sessionId || '').trim();
  if (!safeUserId || !safeSessionId) return null;

  try {
    const raw = window.localStorage.getItem(getStorageKey(safeUserId, safeSessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSearchSession;
    if (!parsed || parsed.version !== 1 || parsed.sessionId !== safeSessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePersistedSearchSession(userId: string, session: PersistedSearchSession): void {
  if (typeof window === 'undefined') return;
  const safeUserId = String(userId || '').trim();
  const safeSessionId = String(session.sessionId || '').trim();
  if (!safeUserId || !safeSessionId) return;

  try {
    window.localStorage.setItem(
      getStorageKey(safeUserId, safeSessionId),
      JSON.stringify({
        ...session,
        sessionId: safeSessionId,
        updatedAt: Date.now(),
      } satisfies PersistedSearchSession),
    );
  } catch {
    // Ignore storage quota and serialization failures.
  }
}

export function listRecentSearchSummaries(userId: string, limit = DEFAULT_RECENT_SEARCH_LIMIT): RecentSearchSummary[] {
  if (typeof window === 'undefined') return [];
  const safeUserId = String(userId || '').trim();
  if (!safeUserId) return [];

  try {
    const prefix = getStoragePrefix(safeUserId);
    const seen = new Set<string>();
    const summaries: RecentSearchSummary[] = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith(prefix)) continue;

      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw) as PersistedSearchSession;
        if (!isValidPersistedSession(parsed)) continue;
        if (seen.has(parsed.sessionId)) continue;
        seen.add(parsed.sessionId);
        summaries.push(toRecentSearchSummary(parsed));
      } catch {
        continue;
      }
    }

    return summaries
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, Math.max(1, limit));
  } catch {
    return [];
  }
}
