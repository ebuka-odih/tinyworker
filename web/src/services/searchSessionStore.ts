import { SearchResult, TimelineItem } from '../types';

export type JobSearchIntakeData = {
  roles?: string[];
  location?: string;
  visaSponsorship?: boolean;
  remote?: boolean;
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
  startedAt: number | null;
  lastSequence: number;
  updatedAt: number;
};

const STORAGE_PREFIX = 'tinyworker:search-session:';

function getStorageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}`;
}

export function readPersistedSearchSession(sessionId: string): PersistedSearchSession | null {
  if (typeof window === 'undefined') return null;
  const safeSessionId = String(sessionId || '').trim();
  if (!safeSessionId) return null;

  try {
    const raw = window.localStorage.getItem(getStorageKey(safeSessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSearchSession;
    if (!parsed || parsed.version !== 1 || parsed.sessionId !== safeSessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePersistedSearchSession(session: PersistedSearchSession): void {
  if (typeof window === 'undefined') return;
  const safeSessionId = String(session.sessionId || '').trim();
  if (!safeSessionId) return;

  try {
    window.localStorage.setItem(
      getStorageKey(safeSessionId),
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
