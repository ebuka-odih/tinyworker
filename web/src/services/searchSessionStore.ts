import { SearchCacheState, SearchResult, SearchType, TimelineItem } from '../types';

export type SearchSourceScope = 'global' | 'regional';

export type SearchIntakeData = {
  searchType?: SearchType;
  roles?: string[];
  location?: string;
  visaSponsorship?: boolean;
  remote?: boolean;
  experience?: 'Entry' | 'Mid' | 'Senior';
  years?: string;
  industry?: string;
  salary?: string;
  sourceScope?: SearchSourceScope;
  expandSearch?: boolean;
  strictMatching?: boolean;
  scholarshipQuery?: string;
  studyLevel?: 'Undergraduate' | 'Masters' | 'PhD' | 'Professional';
  destinationRegion?: string;
  fundingType?: 'Full funding' | 'Partial funding' | 'Tuition only' | 'Any funding';
  intakeTerm?: string;
  academicBackground?: string;
  scholarshipDocumentName?: string | null;
  visaCountry?: string;
  visaCategory?: 'Work visa' | 'Student visa' | 'Skilled migration' | 'Digital nomad visa' | 'Tourist visa';
  nationality?: string;
  currentResidence?: string;
  travelReason?: string;
  visaTimeline?: string;
  visaDocumentName?: string | null;
};

export type JobSearchIntakeData = SearchIntakeData;

export type PersistedSearchStatus = 'running' | 'paused' | 'completed' | 'error';
export type PersistedSearchPhase = 'initializing' | 'streaming' | 'background-monitoring' | 'completed' | 'error';
export type PersistedSearchTab = 'all' | 'shortlisted' | 'saved';

export type PersistedSearchSession = {
  version: 1;
  sessionId: string;
  type?: SearchType;
  formData: SearchIntakeData;
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
  type: SearchType;
  formData: SearchIntakeData;
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

function resolveSearchType(sessionType: SearchType | null | undefined, formData: SearchIntakeData | null | undefined): SearchType {
  if (sessionType === SearchType.SCHOLARSHIP || sessionType === SearchType.VISA || sessionType === SearchType.JOB) {
    return sessionType;
  }
  if (formData?.searchType === SearchType.SCHOLARSHIP || formData?.searchType === SearchType.VISA || formData?.searchType === SearchType.JOB) {
    return formData.searchType;
  }
  return SearchType.JOB;
}

function hasSearchCriteria(formData: SearchIntakeData | null | undefined, type: SearchType = SearchType.JOB): boolean {
  if (!formData) return false;
  if (type === SearchType.SCHOLARSHIP) {
    return Boolean(formData.scholarshipQuery || formData.destinationRegion || formData.studyLevel || formData.academicBackground);
  }
  if (type === SearchType.VISA) {
    return Boolean(formData.visaCountry || formData.visaCategory || formData.nationality || formData.travelReason);
  }
  return Boolean(formData.location) || Boolean(formData.remote) || Boolean(formData.visaSponsorship) || (Array.isArray(formData.roles) && formData.roles.length > 0);
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

function normalizeText(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function searchFingerprint(type: SearchType, formData: SearchIntakeData): string {
  if (type === SearchType.SCHOLARSHIP) {
    return JSON.stringify({
      type,
      scholarshipQuery: normalizeText(formData.scholarshipQuery),
      destinationRegion: normalizeText(formData.destinationRegion),
      studyLevel: normalizeText(formData.studyLevel),
      fundingType: normalizeText(formData.fundingType),
      academicBackground: normalizeText(formData.academicBackground),
      intakeTerm: normalizeText(formData.intakeTerm),
    });
  }

  if (type === SearchType.VISA) {
    return JSON.stringify({
      type,
      visaCountry: normalizeText(formData.visaCountry),
      visaCategory: normalizeText(formData.visaCategory),
      nationality: normalizeText(formData.nationality),
      currentResidence: normalizeText(formData.currentResidence),
      travelReason: normalizeText(formData.travelReason),
      visaTimeline: normalizeText(formData.visaTimeline),
    });
  }

  return JSON.stringify({
    type,
    roles: normalizeList(formData.roles),
    location: normalizeText(formData.location),
    remote: Boolean(formData.remote),
    visaSponsorship: Boolean(formData.visaSponsorship),
    experience: normalizeText(formData.experience),
    years: normalizeText(formData.years),
    industry: normalizeText(formData.industry),
    salary: normalizeText(formData.salary),
    sourceScope: normalizeText(formData.sourceScope),
  });
}

function isValidPersistedSession(session: PersistedSearchSession | null | undefined): session is PersistedSearchSession {
  if (!session || session.version !== 1) return false;
  if (!String(session.sessionId || '').trim()) return false;
  if (!hasSearchCriteria(session.formData, resolveSearchType(session.type, session.formData))) return false;
  return true;
}

function toRecentSearchSummary(session: PersistedSearchSession): RecentSearchSummary {
  const type = resolveSearchType(session.type, session.formData);
  return {
    sessionId: session.sessionId,
    type,
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
    return {
      ...parsed,
      type: resolveSearchType(parsed.type, parsed.formData),
    };
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
    const summariesByFingerprint = new Map<string, RecentSearchSummary>();

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith(prefix)) continue;

      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw) as PersistedSearchSession;
        if (!isValidPersistedSession(parsed)) continue;
        const type = resolveSearchType(parsed.type, parsed.formData);
        const summary = toRecentSearchSummary(parsed);
        const fingerprint = searchFingerprint(type, parsed.formData);
        const existing = summariesByFingerprint.get(fingerprint);

        if (!existing || summary.updatedAt > existing.updatedAt) {
          summariesByFingerprint.set(fingerprint, summary);
        }
      } catch {
        continue;
      }
    }

    return Array.from(summariesByFingerprint.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, Math.max(1, limit));
  } catch {
    return [];
  }
}
