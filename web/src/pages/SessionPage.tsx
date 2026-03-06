import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Play,
  Pause,
  Square,
  ExternalLink,
  Bookmark,
  CheckCircle2,
  Loader2,
  Filter,
  Search,
  AlertCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  Lock,
  Crown,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AuthUser, JobQueueStatus, SearchCacheState, SearchResult, TimelineItem, TimelineSeverity, TimelineStatus } from '../types';
import {
  ApiUnauthorizedError,
  SearchRunEvent,
  SearchRunSnapshot,
  connectJobSearchRunStream,
  getJobSearchRunSnapshot,
  startJobSearchRun,
  stopJobSearchRun,
} from '../services/jobSearchStreamApi';
import {
  JobSearchIntakeData,
  PersistedSearchSession,
  readPersistedSearchSession,
  writePersistedSearchSession,
} from '../services/searchSessionStore';
import { useAuth } from '../auth/AuthContext';
import { JobDetailsModal } from '../components/JobDetailsModal';
import { listSavedOpportunities, saveJobOpportunity } from '../services/opportunitiesApi';

type SessionLocationState = {
  formData?: JobSearchIntakeData;
};

type SearchPhase = 'initializing' | 'streaming' | 'background-monitoring' | 'completed' | 'error';
type SessionStartupMode = 'new' | 'resume' | 'missing';
type ResultFitFilter = 'all' | SearchResult['fitScore'];
type ResultStageFilter = 'all' | 'ready' | 'extracting' | 'queued' | 'failed';

const COUNTRY_CODES: Record<string, string> = {
  Germany: 'DE',
  'United Kingdom': 'GB',
  Canada: 'CA',
  'United States': 'US',
  Netherlands: 'NL',
};

const SNAPSHOT_POLL_INTERVAL_MS = 5_000;
type SidebarTab = 'filters' | 'sources';
type SourcePanelStatus = 'Completed' | 'Searching' | 'Failed' | 'Queued' | 'Included';
const SOURCE_CATALOG = [
  {
    name: 'LinkedIn Jobs',
    domain: 'linkedin.com/jobs',
    summary: 'Large current-job index with strong employer coverage.',
    emphasis: 'Best for volume',
  },
  {
    name: 'Indeed',
    domain: 'indeed.com',
    summary: 'Broad coverage across direct employer and ATS listings.',
    emphasis: 'Best for breadth',
  },
  {
    name: 'Glassdoor',
    domain: 'glassdoor.com',
    summary: 'High-signal employer pages and recent openings.',
    emphasis: 'Employer context',
  },
  {
    name: 'Greenhouse',
    domain: 'boards.greenhouse.io',
    summary: 'Direct ATS listings from tech and startup teams.',
    emphasis: 'Direct ATS',
  },
  {
    name: 'Lever',
    domain: 'jobs.lever.co',
    summary: 'Direct ATS roles that often appear before aggregation.',
    emphasis: 'Direct ATS',
  },
  {
    name: 'Ashby',
    domain: 'jobs.ashbyhq.com',
    summary: 'Fast-moving startup and growth-company hiring.',
    emphasis: 'Startup ATS',
  },
  {
    name: 'Djinni',
    domain: 'djinni.co',
    summary: 'Developer-friendly board with strong European overlap.',
    emphasis: 'Regional quality',
  },
] as const;

function hasSessionCriteria(formData: JobSearchIntakeData | null | undefined) {
  if (!formData) return false;
  return (
    Boolean(formData.location) ||
    Boolean(formData.remote) ||
    Boolean(formData.visaSponsorship) ||
    (Array.isArray(formData.roles) && formData.roles.length > 0)
  );
}

function countResultsByQueueStatus(items: SearchResult[]) {
  return items.reduce(
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

function buildTimelineItem(
  title: string,
  description: string,
  severity: TimelineSeverity = 'info',
  status: TimelineStatus = 'running',
): TimelineItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    title,
    description,
    severity,
    status,
  };
}

function fitClass(fit: SearchResult['fitScore']) {
  if (fit === 'High') return 'bg-emerald-50 text-emerald-600';
  if (fit === 'Medium') return 'bg-amber-50 text-amber-600';
  return 'bg-orange-50 text-orange-600';
}

function queueClass(status: JobQueueStatus) {
  if (status === 'queued') return 'bg-neutral-100 text-neutral-600';
  if (status === 'extracting') return 'bg-sky-50 text-sky-700';
  if (status === 'verified') return 'bg-emerald-50 text-emerald-700';
  if (status === 'ready') return 'bg-emerald-50 text-emerald-700';
  return 'bg-red-50 text-red-700';
}

function queueLabel(status: JobQueueStatus) {
  if (status === 'queued') return 'Queued';
  if (status === 'extracting') return 'Extracting';
  if (status === 'verified') return 'Verified';
  if (status === 'ready') return 'Ready';
  return 'Failed';
}

function formatCacheAge(ageMs: number | undefined) {
  const totalMinutes = Math.max(0, Math.floor(Number(ageMs || 0) / 60_000));
  if (totalMinutes < 1) return 'just now';
  if (totalMinutes < 60) return `${totalMinutes}m ago`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!minutes) return `${hours}h ago`;
  return `${hours}h ${minutes}m ago`;
}

function isReadyLike(status: JobQueueStatus) {
  return status === 'ready' || status === 'verified';
}

function mergeSearchResult(existing: SearchResult | undefined, incoming: SearchResult): SearchResult {
  if (!existing) return incoming;
  if (isReadyLike(existing.queueStatus) && !isReadyLike(incoming.queueStatus)) {
    return existing;
  }

  return {
    ...existing,
    ...incoming,
    requirements: incoming.requirements?.length ? incoming.requirements : existing.requirements,
    responsibilities: incoming.responsibilities?.length ? incoming.responsibilities : existing.responsibilities,
    benefits: incoming.benefits?.length ? incoming.benefits : existing.benefits,
  };
}

function sortSearchResults(items: SearchResult[]) {
  const queuePriority = (status: JobQueueStatus) => {
    if (status === 'ready' || status === 'verified') return 0;
    if (status === 'extracting') return 1;
    if (status === 'queued') return 2;
    return 3;
  };

  return [...items].sort((a, b) => {
    const statusDelta = queuePriority(a.queueStatus) - queuePriority(b.queueStatus);
    if (statusDelta !== 0) return statusDelta;

    const ap = typeof a.queuePosition === 'number' ? a.queuePosition : Number.MAX_SAFE_INTEGER;
    const bp = typeof b.queuePosition === 'number' ? b.queuePosition : Number.MAX_SAFE_INTEGER;
    if (ap !== bp) return ap - bp;
    return (b.relevance || 0) - (a.relevance || 0);
  });
}

function resultIdentity(result: Pick<SearchResult, 'link' | 'title' | 'organization' | 'location'>) {
  const link = String(result.link || '').trim().toLowerCase();
  if (link) return `link:${link}`;
  return [
    'job',
    String(result.title || '').trim().toLowerCase(),
    String(result.organization || '').trim().toLowerCase(),
    String(result.location || '').trim().toLowerCase(),
  ].join('::');
}

function getSubscriptionTier(authUser: AuthUser | null): 'free' | 'pro' | 'team' {
  const rawTier = String(authUser?.subscriptionTier || '').trim().toLowerCase();
  if (authUser?.isPro) return 'pro';
  if (rawTier === 'team' || rawTier === 'business' || rawTier === 'enterprise') return 'team';
  if (rawTier === 'pro' || rawTier === 'premium' || rawTier === 'paid') return 'pro';
  return 'free';
}

function planLabel(tier: 'free' | 'pro' | 'team') {
  if (tier === 'team') return 'Team';
  if (tier === 'pro') return 'Pro';
  return 'Starter';
}

function planBadgeClass(tier: 'free' | 'pro' | 'team') {
  if (tier === 'team') return 'border-sky-200 bg-sky-100 text-sky-800';
  if (tier === 'pro') return 'border-amber-200 bg-amber-100 text-amber-800';
  return 'border-neutral-200 bg-neutral-100 text-neutral-600';
}

function sourceStatusRank(status: SourcePanelStatus) {
  if (status === 'Completed') return 0;
  if (status === 'Searching') return 1;
  if (status === 'Failed') return 2;
  if (status === 'Queued') return 3;
  return 4;
}

function matchesResultStageFilter(result: SearchResult, filter: ResultStageFilter) {
  if (filter === 'all') return true;
  if (filter === 'ready') return result.queueStatus === 'ready' || result.queueStatus === 'verified';
  return result.queueStatus === filter;
}

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { accessToken, authUser, signOut } = useAuth();
  const authUserId = String(authUser?.userId || '').trim();
  const subscriptionTier = React.useMemo(() => getSubscriptionTier(authUser), [authUser]);
  const hasAdvancedAccess = subscriptionTier !== 'free';
  const state = (location.state || {}) as SessionLocationState;
  const [sessionFormData, setSessionFormData] = React.useState<JobSearchIntakeData>(state.formData || {});
  const roles = sessionFormData.roles || [];
  const primaryRole = roles[0] || 'Backend Roles';
  const locationLabel = sessionFormData.location || 'Any location';
  const countryCode =
    sessionFormData.location && sessionFormData.location !== 'Any location'
      ? COUNTRY_CODES[sessionFormData.location]
      : undefined;
  const searchQuery = React.useMemo(() => {
    const strictMatching = Boolean(sessionFormData.strictMatching);
    const rolePart = roles.length
      ? roles.map((role) => (strictMatching ? `"${role}"` : role)).join(' OR ')
      : strictMatching
      ? '"backend engineer"'
      : 'backend engineer';
    const sponsorshipPart = sessionFormData.visaSponsorship ? 'with visa sponsorship' : '';
    const remotePart = sessionFormData.remote ? 'remote' : '';
    const locationPart = locationLabel !== 'Any location' ? `jobs in ${locationLabel}` : '';
    return [rolePart, locationPart, sponsorshipPart, remotePart].filter(Boolean).join(' ');
  }, [roles, sessionFormData.strictMatching, sessionFormData.visaSponsorship, sessionFormData.remote, locationLabel]);

  const [status, setStatus] = React.useState<'running' | 'paused' | 'completed' | 'error'>('running');
  const [searchPhase, setSearchPhase] = React.useState<SearchPhase>('initializing');
  const [elapsedTime, setElapsedTime] = React.useState(0);
  const [timeline, setTimeline] = React.useState<TimelineItem[]>([]);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [activeTab, setActiveTab] = React.useState<'all' | 'shortlisted' | 'saved'>('all');
  const [runId, setRunId] = React.useState<string | null>(null);
  const [cacheState, setCacheState] = React.useState<SearchCacheState | null>(null);
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);
  const [startedAtMs, setStartedAtMs] = React.useState<number | null>(null);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [savedJobKeys, setSavedJobKeys] = React.useState<Set<string>>(new Set());
  const [savingJobIds, setSavingJobIds] = React.useState<Set<string>>(new Set());
  const [isMobileActivityCollapsed, setIsMobileActivityCollapsed] = React.useState(true);
  const [sidebarTab, setSidebarTab] = React.useState<SidebarTab>('filters');
  const [resultFitFilter, setResultFitFilter] = React.useState<ResultFitFilter>('all');
  const [resultStageFilter, setResultStageFilter] = React.useState<ResultStageFilter>('all');
  const [resultSourceFilter, setResultSourceFilter] = React.useState<string>('all');

  const streamRef = React.useRef<{ close: () => void } | null>(null);
  const snapshotPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const snapshotRequestInFlightRef = React.useRef(false);
  const isPausedRef = React.useRef(false);
  const isCompletedRef = React.useRef(false);
  const eventQueueRef = React.useRef<SearchRunEvent[]>([]);
  const lastSequenceRef = React.useRef(0);
  const hasStartedRef = React.useRef(false);
  const lastSnapshotStatusRef = React.useRef<string | null>(null);
  const lastSnapshotCountsRef = React.useRef({ ready: 0, failed: 0, queued: 0 });
  const startupModeRef = React.useRef<SessionStartupMode>('new');

  const selectedJob = React.useMemo(
    () => results.find((item) => item.id === selectedJobId) || null,
    [results, selectedJobId],
  );

  const closeStream = React.useCallback(() => {
    streamRef.current?.close();
    streamRef.current = null;
  }, []);

  const clearSnapshotPolling = React.useCallback(() => {
    if (snapshotPollRef.current) {
      clearInterval(snapshotPollRef.current);
      snapshotPollRef.current = null;
    }
    snapshotRequestInFlightRef.current = false;
  }, []);

  const clearRunActivity = React.useCallback(() => {
    closeStream();
    clearSnapshotPolling();
  }, [clearSnapshotPolling, closeStream]);

  const redirectToAuth = React.useCallback(() => {
    clearRunActivity();
    signOut();
    const nextPath = `${location.pathname}${location.search}${location.hash}`;
    navigate(`/auth?next=${encodeURIComponent(nextPath)}`, { replace: true });
  }, [clearRunActivity, location.hash, location.pathname, location.search, navigate, signOut]);

  const addTimelineEvent = React.useCallback((title: string, description: string, severity: TimelineSeverity = 'info', eventStatus: TimelineStatus = 'running') => {
    setTimeline((prev) => [buildTimelineItem(title, description, severity, eventStatus), ...prev]);
  }, []);

  React.useEffect(() => {
    if (selectedJobId && !selectedJob) {
      setSelectedJobId(null);
    }
  }, [selectedJob, selectedJobId]);

  const upsertResult = React.useCallback((incoming: SearchResult) => {
    setResults((prev) => {
      const next = [...prev];
      const existingIndex = next.findIndex((item) => item.id === incoming.id);
      if (existingIndex >= 0) {
        next[existingIndex] = mergeSearchResult(next[existingIndex], incoming);
      } else {
        next.push(incoming);
      }
      return sortSearchResults(next);
    });
  }, []);

  const markResultStatus = React.useCallback((resultId: string, nextStatus: SearchResult['status']) => {
    setResults((prev) =>
      sortSearchResults(
        prev.map((item) => (item.id === resultId ? { ...item, status: nextStatus } : item)),
      ),
    );
  }, []);

  const finalizeRunState = React.useCallback(
    (nextStatus: 'completed' | 'error', phase: SearchPhase, title: string, description: string, severity: TimelineSeverity) => {
      if (!isCompletedRef.current) {
        addTimelineEvent(title, description, severity, nextStatus === 'error' ? 'failed' : 'completed');
      }
      setStatus(nextStatus);
      setSearchPhase(phase);
      isCompletedRef.current = true;
      clearRunActivity();
    },
    [addTimelineEvent, clearRunActivity],
  );

  const applySnapshot = React.useCallback(
    (snapshot: SearchRunSnapshot | null) => {
      if (!snapshot) return;
      const snapshotResults = Array.isArray(snapshot.results) ? snapshot.results : [];
      if (snapshotResults.length) {
        setResults((prev) => {
          const next = new Map<string, SearchResult>(prev.map((item) => [item.id, item]));
          snapshotResults.forEach((item) => {
            const existing = next.get(item.id);
            next.set(item.id, mergeSearchResult(existing, item));
          });
          return sortSearchResults(Array.from(next.values()));
        });
      }
      setCacheState(snapshot.cache || null);
      lastSequenceRef.current = Math.max(lastSequenceRef.current, Number(snapshot.lastSequence || 0));

      const counts = {
        queued: Number(snapshot.counts?.queued || 0),
        ready: Number(snapshot.counts?.ready || 0),
        failed: Number(snapshot.counts?.failed || 0),
      };

      if (searchPhase === 'background-monitoring' && snapshot.status === 'running') {
        const previous = lastSnapshotCountsRef.current;
        if (
          previous.ready !== counts.ready ||
          previous.failed !== counts.failed ||
          previous.queued !== counts.queued
        ) {
          addTimelineEvent(
            'Background progress',
            `${counts.ready} ready • ${counts.failed} failed • ${counts.queued} queued`,
            'info',
            'running',
          );
        }
      }
      lastSnapshotCountsRef.current = counts;

      if (snapshot.status === lastSnapshotStatusRef.current && snapshot.status !== 'running') return;
      lastSnapshotStatusRef.current = snapshot.status;

      if (snapshot.status === 'completed') {
        finalizeRunState('completed', 'completed', 'Search completed', 'Queue finished and results are now stable.', 'success');
        return;
      }

      if (snapshot.status === 'stopped') {
        finalizeRunState('completed', 'completed', 'Search stopped', 'Search session ended manually.', 'warning');
        return;
      }

      if (snapshot.status === 'failed') {
        const timeoutEvent = Array.isArray(snapshot.events)
          ? snapshot.events.find(
              (event) => event.type === 'run_error' && String(event.payload?.code || '').toLowerCase() === 'timeout',
            )
          : null;
        const description = String(timeoutEvent?.payload?.message || 'Search run failed before completion.');
        finalizeRunState('error', 'error', timeoutEvent ? 'Run timeout' : 'Search failed', description, timeoutEvent ? 'warning' : 'error');
      }
    },
    [addTimelineEvent, finalizeRunState, searchPhase],
  );

  const applyRunEvent = React.useCallback(
    (event: SearchRunEvent) => {
      if (!event) return;
      lastSequenceRef.current = Math.max(lastSequenceRef.current, Number(event.sequence || 0));

      if (event.type === 'run_started') {
        clearSnapshotPolling();
        setSearchPhase('streaming');
        addTimelineEvent('Initializing search agent', 'Preparing verified sources and extraction queue.', 'info', 'running');
        return;
      }

      if (event.type === 'run_cache_hit') {
        const cache = (event.payload?.cache || null) as SearchCacheState | null;
        setCacheState(cache);
        if (cache) {
          const cacheModeLabel = cache.mode === 'intent' ? 'similar search' : 'same search';
          addTimelineEvent(
            'Showing saved results',
            `Loaded cached results from a ${cacheModeLabel} run (${formatCacheAge(cache.ageMs)}). Refreshing in the background.`,
            'info',
            'running',
          );
        }
        return;
      }

      if (event.type === 'source_scan_started') {
        addTimelineEvent('Scanning verified job sources', 'Discovery phase started across trusted job websites.', 'info', 'running');
        return;
      }

      if (event.type === 'candidate_queued' && event.payload?.result) {
        const item = event.payload.result as SearchResult;
        upsertResult(item);
        addTimelineEvent('Opportunity queued', `${item.title} from ${item.sourceName} is queued for extraction.`, 'info', 'queued');
        return;
      }

      if (event.type === 'candidate_extracting' && event.payload?.result) {
        const item = event.payload.result as SearchResult;
        upsertResult(item);
        addTimelineEvent('Extracting job details', `Extracting structured fields from ${item.sourceName}.`, 'info', 'running');
        return;
      }

      if (event.type === 'candidate_ready' && event.payload?.result) {
        const item = event.payload.result as SearchResult;
        upsertResult(item);
        if (!event.payload?.cacheHit) {
          addTimelineEvent('Job card ready', `${item.title} is ready from ${item.sourceName}.`, 'success', 'completed');
        }
        return;
      }

      if (event.type === 'candidate_failed' && event.payload?.result) {
        const item = event.payload.result as SearchResult;
        upsertResult(item);
        addTimelineEvent('Source extraction failed', `Could not extract full details for ${item.title}.`, 'warning', 'failed');
        return;
      }

      if (event.type === 'run_progress') {
        const ready = Number(event.payload?.ready || 0);
        const failed = Number(event.payload?.failed || 0);
        addTimelineEvent('Search progress', `${ready} ready • ${failed} failed`, 'info', 'running');
        return;
      }

      if (event.type === 'run_completed') {
        setCacheState((prev) => (prev ? { ...prev, refreshing: false } : null));
        if (event.runId) {
          void getJobSearchRunSnapshot(event.runId, accessToken)
            .then((snapshot) => {
              applySnapshot(snapshot);
              finalizeRunState('completed', 'completed', 'Search completed', 'Queue finished and results are now stable.', 'success');
            })
            .catch(() => {
              finalizeRunState('completed', 'completed', 'Search completed', 'Queue finished and results are now stable.', 'success');
            });
          return;
        }
        finalizeRunState('completed', 'completed', 'Search completed', 'Queue finished and results are now stable.', 'success');
        return;
      }

      if (event.type === 'run_stopped') {
        setCacheState((prev) => (prev ? { ...prev, refreshing: false } : null));
        finalizeRunState('completed', 'completed', 'Search stopped', 'Run was stopped manually.', 'warning');
        return;
      }

      if (event.type === 'run_error') {
        setCacheState((prev) => (prev ? { ...prev, refreshing: false } : null));
        const details = String(event.payload?.message || 'Unknown search error');
        const isTimeout = String(event.payload?.code || '').toLowerCase() === 'timeout';
        finalizeRunState('error', 'error', isTimeout ? 'Run timeout' : 'Search error', details, isTimeout ? 'warning' : 'error');
      }
    },
    [accessToken, addTimelineEvent, applySnapshot, clearSnapshotPolling, finalizeRunState, upsertResult],
  );

  const flushQueuedEvents = React.useCallback(() => {
    const queued = eventQueueRef.current;
    if (!queued.length) return;
    eventQueueRef.current = [];
    queued.forEach((event) => applyRunEvent(event));
  }, [applyRunEvent]);

  const connectToRunStream = React.useCallback(
    (searchRunId: string) => {
      closeStream();
      streamRef.current = connectJobSearchRunStream({
        runId: searchRunId,
        token: accessToken,
        since: lastSequenceRef.current,
        onEvent: (event) => {
          const seq = Number(event.sequence || 0);
          if (seq && seq <= lastSequenceRef.current) return;
          if (isPausedRef.current) {
            eventQueueRef.current.push(event);
            return;
          }
          applyRunEvent(event);
        },
        onSnapshot: applySnapshot,
        onError: (error) => {
          if (error instanceof ApiUnauthorizedError) {
            redirectToAuth();
            return;
          }
          if (isCompletedRef.current) return;
          addTimelineEvent('Stream reconnecting', 'Live updates interrupted. Trying to reconnect.', 'warning', 'running');
        },
      });
    },
    [accessToken, addTimelineEvent, applyRunEvent, applySnapshot, closeStream, redirectToAuth],
  );

  const startSnapshotPolling = React.useCallback(
    (searchRunId: string) => {
      clearSnapshotPolling();

      const poll = async () => {
        if (snapshotRequestInFlightRef.current || isCompletedRef.current) return;
        snapshotRequestInFlightRef.current = true;
        try {
          const snapshot = await getJobSearchRunSnapshot(searchRunId, accessToken);
          applySnapshot(snapshot);
        } catch (error) {
          if (error instanceof ApiUnauthorizedError) {
            redirectToAuth();
            return;
          }
          if (!isCompletedRef.current) {
            addTimelineEvent('Background sync delayed', 'Could not refresh background search state. Retrying shortly.', 'warning', 'running');
          }
        } finally {
          snapshotRequestInFlightRef.current = false;
        }
      };

      void poll();
      snapshotPollRef.current = setInterval(() => {
        void poll();
      }, SNAPSHOT_POLL_INTERVAL_MS);
    },
    [accessToken, addTimelineEvent, applySnapshot, clearSnapshotPolling, redirectToAuth],
  );

  const enterBackgroundMonitoring = React.useCallback(
    (searchRunId: string, suppressTimeline = false) => {
      closeStream();
      setStatus('running');
      setSearchPhase('background-monitoring');
      if (!suppressTimeline) {
        addTimelineEvent(
          'Live stream interrupted',
          'Live updates paused. Search continues in the background and results will keep refreshing automatically.',
          'warning',
          'running',
        );
      }
      startSnapshotPolling(searchRunId);
    },
    [addTimelineEvent, closeStream, startSnapshotPolling],
  );

  const handleStartFailure = React.useCallback(
    (error: unknown) => {
      if (error instanceof ApiUnauthorizedError) {
        redirectToAuth();
        return;
      }
      const message = error instanceof Error ? error.message : 'Search run could not be started.';
      setResults([]);
      setCacheState(null);
      setStatus('error');
      setSearchPhase('error');
      isCompletedRef.current = true;
      clearRunActivity();
      addTimelineEvent('Search unavailable', message, 'error', 'failed');
    },
    [addTimelineEvent, clearRunActivity, redirectToAuth],
  );

  React.useEffect(() => {
    hasStartedRef.current = false;
    eventQueueRef.current = [];
    clearRunActivity();

    const persisted = id && authUserId ? readPersistedSearchSession(authUserId, id) : null;
    const nextFormData = persisted?.formData || state.formData || {};

    setSessionFormData(nextFormData);
    setSelectedJobId(null);
    lastSnapshotStatusRef.current = null;
    lastSnapshotCountsRef.current = countResultsByQueueStatus(persisted?.results || []);
    lastSequenceRef.current = Number(persisted?.lastSequence || 0);

    if (persisted) {
      startupModeRef.current = 'resume';
      setStatus(persisted.status);
      setSearchPhase(persisted.searchPhase);
      setElapsedTime(
        persisted.startedAt && persisted.status === 'running'
          ? Math.max(persisted.elapsedTime, Math.floor((Date.now() - persisted.startedAt) / 1000))
          : persisted.elapsedTime,
      );
      setTimeline(persisted.timeline || []);
      setResults(persisted.results || []);
      setActiveTab(persisted.activeTab || 'all');
      setRunId(persisted.runId || null);
      setCacheState(persisted.cache || null);
      setStartedAtMs(persisted.startedAt || null);
      isCompletedRef.current = persisted.status === 'completed' || persisted.status === 'error';
      setIsHydrated(true);
      return;
    }

    if (hasSessionCriteria(nextFormData)) {
      startupModeRef.current = 'new';
      setStatus('running');
      setSearchPhase('initializing');
      setElapsedTime(0);
      setTimeline([]);
      setResults([]);
      setActiveTab('all');
      setRunId(null);
      setCacheState(null);
      setStartedAtMs(null);
      isCompletedRef.current = false;
      setIsHydrated(true);
      return;
    }

    startupModeRef.current = 'missing';
    setStatus('error');
    setSearchPhase('error');
    setElapsedTime(0);
    setTimeline([
      buildTimelineItem(
        'Search unavailable',
        'This session has no saved search data. Start a new search to create a fresh session.',
        'error',
        'failed',
      ),
    ]);
    setResults([]);
    setActiveTab('all');
    setRunId(null);
    setCacheState(null);
    setStartedAtMs(null);
    isCompletedRef.current = true;
    setIsHydrated(true);
  }, [authUserId, clearRunActivity, id, state.formData]);

  React.useEffect(() => {
    if (!id || !isHydrated || !authUserId) return;

    const payload: PersistedSearchSession = {
      version: 1,
      sessionId: id,
      formData: sessionFormData,
      status,
      searchPhase,
      elapsedTime,
      timeline,
      results,
      activeTab,
      runId,
      cache: cacheState,
      startedAt: startedAtMs,
      lastSequence: lastSequenceRef.current,
      updatedAt: Date.now(),
    };

    writePersistedSearchSession(authUserId, payload);
  }, [activeTab, authUserId, cacheState, elapsedTime, id, isHydrated, results, runId, searchPhase, sessionFormData, startedAtMs, status, timeline]);

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (status === 'running' && !isCompletedRef.current) {
      const updateElapsed = () => {
        if (startedAtMs) {
          setElapsedTime(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
          return;
        }
        setElapsedTime((prev) => prev + 1);
      };
      updateElapsed();
      timer = setInterval(() => {
        updateElapsed();
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [startedAtMs, status]);

  React.useEffect(() => {
    isPausedRef.current = status === 'paused';
  }, [status]);

  React.useEffect(() => {
    if (!accessToken) {
      setSavedJobKeys(new Set());
      return;
    }

    let cancelled = false;

    const restoreSavedJobs = async () => {
      try {
        const saved = await listSavedOpportunities(accessToken, 'job');
        if (cancelled) return;
        const nextKeys = new Set(
          saved.map((item) =>
            resultIdentity({
              link: item.link || '',
              title: item.title,
              organization: item.organization || '',
              location: item.location || '',
            }),
          ),
        );
        setSavedJobKeys(nextKeys);
        setResults((prev) =>
          sortSearchResults(
            prev.map((item) =>
              nextKeys.has(resultIdentity(item)) && item.status !== 'shortlisted'
                ? { ...item, status: 'saved' }
                : item,
            ),
          ),
        );
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiUnauthorizedError) {
          redirectToAuth();
        }
      }
    };

    void restoreSavedJobs();

    return () => {
      cancelled = true;
    };
  }, [accessToken, redirectToAuth]);

  const startNewRun = React.useCallback(async () => {
    isCompletedRef.current = false;
    eventQueueRef.current = [];
    lastSnapshotStatusRef.current = null;
    lastSnapshotCountsRef.current = { ready: 0, failed: 0, queued: 0 };
    setCacheState(null);
    const now = Date.now();
    setStartedAtMs(now);
    setElapsedTime(0);
    setSearchPhase('initializing');
    addTimelineEvent('Starting search run', `Running: "${searchQuery}"`, 'info', 'running');

    try {
      const started = await startJobSearchRun({
        token: accessToken,
        query: searchQuery,
        countryCode,
        maxNumResults: 10,
        sourceScope: sessionFormData.sourceScope || 'global',
        remote: sessionFormData.remote,
        visaSponsorship: sessionFormData.visaSponsorship,
      });
      setRunId(started.runId);
      connectToRunStream(started.runId);
    } catch (error) {
      handleStartFailure(error);
    }
  }, [
    accessToken,
    addTimelineEvent,
    connectToRunStream,
    countryCode,
    handleStartFailure,
    searchQuery,
    sessionFormData.remote,
    sessionFormData.sourceScope,
    sessionFormData.visaSponsorship,
  ]);

  const resumePersistedSession = React.useCallback(async () => {
    if (!runId) {
      isCompletedRef.current = true;
      setStatus((prev) => (prev === 'error' ? 'error' : 'completed'));
      setSearchPhase((prev) => (prev === 'error' ? 'error' : 'completed'));
      if (!results.length) {
        addTimelineEvent('Showing saved session', 'Restored the saved search page without starting a new run.', 'info', 'completed');
      }
      return;
    }

    try {
      const snapshot = await getJobSearchRunSnapshot(runId, accessToken);
      if (!snapshot) {
        isCompletedRef.current = true;
        setStatus((prev) => (prev === 'error' ? 'error' : 'completed'));
        setSearchPhase((prev) => (prev === 'error' ? 'error' : 'completed'));
        addTimelineEvent(
          'Showing saved results',
          'Could not reconnect to the original run. Displaying the last saved search state without restarting.',
          'warning',
          'completed',
        );
        return;
      }

      applySnapshot(snapshot);

      if (snapshot.status === 'completed' || snapshot.status === 'failed' || snapshot.status === 'stopped') {
        return;
      }

      const effectiveStartedAtMs = startedAtMs || Date.now();
      if (!startedAtMs) {
        setStartedAtMs(effectiveStartedAtMs);
      }

      if (status === 'paused') {
        return;
      }

      if (searchPhase === 'background-monitoring') {
        enterBackgroundMonitoring(runId, true);
        return;
      }

      setStatus('running');
      setSearchPhase('streaming');
      connectToRunStream(runId);
      addTimelineEvent('Restored search session', 'Reconnected to the existing search after refresh.', 'info', 'running');
    } catch (error) {
      if (error instanceof ApiUnauthorizedError) {
        redirectToAuth();
        return;
      }
      isCompletedRef.current = true;
      setStatus((prev) => (prev === 'error' ? 'error' : 'completed'));
      setSearchPhase((prev) => (prev === 'error' ? 'error' : 'completed'));
      addTimelineEvent(
        'Showing saved results',
        'Could not restore live updates after refresh. Keeping the last saved results instead of starting over.',
        'warning',
        'completed',
      );
    }
  }, [
    accessToken,
    addTimelineEvent,
    applySnapshot,
    connectToRunStream,
    enterBackgroundMonitoring,
    redirectToAuth,
    results.length,
    runId,
    searchPhase,
    startedAtMs,
    status,
  ]);

  React.useEffect(() => {
    if (!isHydrated || hasStartedRef.current) return;
    hasStartedRef.current = true;

    if (startupModeRef.current === 'missing') {
      return;
    }

    if (startupModeRef.current === 'resume') {
      if (status === 'completed' || status === 'error') {
        return;
      }
      void resumePersistedSession();
      return;
    }

    void startNewRun();
  }, [isHydrated, resumePersistedSession, startNewRun, status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePause = () => {
    if (status !== 'running' || isCompletedRef.current || searchPhase === 'background-monitoring') return;
    setStatus('paused');
    addTimelineEvent('Search paused', 'Incoming stream updates are queued until resume.', 'warning', 'queued');
  };

  const handleResume = async () => {
    if (status !== 'paused' || isCompletedRef.current) return;
    setStatus('running');
    addTimelineEvent('Search resumed', 'Queued updates are now being applied.', 'info', 'running');
    flushQueuedEvents();
    if (runId && !streamRef.current && searchPhase !== 'background-monitoring') {
      try {
        const snapshot = await getJobSearchRunSnapshot(runId, accessToken);
        applySnapshot(snapshot);
        connectToRunStream(runId);
      } catch (error) {
        if (error instanceof ApiUnauthorizedError) {
          redirectToAuth();
        }
      }
    }
  };

  const handleStop = async () => {
    if (isCompletedRef.current) return;
    if (runId) {
      try {
        await stopJobSearchRun(runId, accessToken);
      } catch (error) {
        if (error instanceof ApiUnauthorizedError) {
          redirectToAuth();
          return;
        }
        // Stop can race with completion; ignore transport errors.
      }
    }
    finalizeRunState('completed', 'completed', 'Search stopped', 'Search session ended manually.', 'warning');
  };

  const handleSaveJob = React.useCallback(
    async (result: SearchResult, nextStatus: 'saved' | 'shortlisted' = 'saved') => {
      if (savingJobIds.has(result.id)) return;

      const key = resultIdentity(result);
      if (savedJobKeys.has(key)) {
        markResultStatus(result.id, nextStatus);
        addTimelineEvent('Already saved', `${result.title} is already in your profile.`, 'info', 'completed');
        return;
      }

      setSavingJobIds((prev) => new Set(prev).add(result.id));
      try {
        const saved = await saveJobOpportunity(accessToken, result);
        const savedKey = resultIdentity({
          link: saved.link || result.link,
          title: saved.title || result.title,
          organization: saved.organization || result.organization,
          location: saved.location || result.location,
        });
        setSavedJobKeys((prev) => {
          const next = new Set(prev);
          next.add(savedKey);
          return next;
        });
        markResultStatus(result.id, nextStatus);
        addTimelineEvent('Saved to profile', `${result.title} is now available in your saved opportunities.`, 'success', 'completed');
      } catch (error) {
        if (error instanceof ApiUnauthorizedError) {
          redirectToAuth();
          return;
        }
        const message = error instanceof Error ? error.message : 'Could not save this job right now.';
        addTimelineEvent('Save failed', message, 'error', 'failed');
      } finally {
        setSavingJobIds((prev) => {
          const next = new Set(prev);
          next.delete(result.id);
          return next;
        });
      }
    },
    [accessToken, addTimelineEvent, markResultStatus, redirectToAuth, savedJobKeys, savingJobIds],
  );

  const isSearching = (status === 'running' || status === 'paused') && !isCompletedRef.current;

  const tabResults = React.useMemo(() => {
    if (activeTab === 'all') return results;
    if (activeTab === 'shortlisted') return results.filter((result) => result.status === 'shortlisted');
    return results.filter((result) => result.status === 'saved');
  }, [results, activeTab]);

  const availableResultSources = React.useMemo(
    () => {
      const sources = tabResults
        .map((result) => String(result.sourceName || '').trim())
        .filter((value): value is string => Boolean(value));
      return Array.from(new Set<string>(sources)).sort((a, b) => a.localeCompare(b));
    },
    [tabResults],
  );

  React.useEffect(() => {
    if (resultSourceFilter === 'all') return;
    if (availableResultSources.includes(resultSourceFilter)) return;
    setResultSourceFilter('all');
  }, [availableResultSources, resultSourceFilter]);

  const visibleResults = React.useMemo(
    () =>
      tabResults.filter((result) => {
        if (resultFitFilter !== 'all' && result.fitScore !== resultFitFilter) {
          return false;
        }
        if (!matchesResultStageFilter(result, resultStageFilter)) {
          return false;
        }
        if (resultSourceFilter !== 'all' && result.sourceName !== resultSourceFilter) {
          return false;
        }
        return true;
      }),
    [resultFitFilter, resultSourceFilter, resultStageFilter, tabResults],
  );

  const hiddenTimelineCount = Math.max(0, timeline.length);

  const statusBadgeClass =
    status === 'running'
      ? 'bg-emerald-50 text-emerald-600'
      : status === 'paused'
      ? 'bg-amber-50 text-amber-600'
      : status === 'error'
      ? 'bg-red-50 text-red-600'
      : 'bg-neutral-100 text-neutral-600';

  const sourceRows = React.useMemo(() => {
    const bySource = new Map<string, { name: string; status: 'Searching' | 'Completed' | 'Failed' }>();
    for (const result of results) {
      const key = result.sourceName || result.sourceDomain || 'Web Source';
      const current = bySource.get(key) || { name: key, status: 'Completed' as const };
      if (result.queueStatus === 'failed') {
        current.status = 'Failed';
      } else if (result.queueStatus === 'queued' || result.queueStatus === 'extracting') {
        current.status = 'Searching';
      } else if (current.status !== 'Failed') {
        current.status = 'Completed';
      }
      bySource.set(key, current);
    }
    if (!bySource.size) {
      return [
        { name: 'LinkedIn Jobs', status: isSearching ? 'Searching' : 'Completed' },
        { name: 'Indeed', status: isSearching ? 'Searching' : 'Completed' },
        { name: 'Glassdoor', status: isSearching ? 'Searching' : 'Completed' },
      ];
    }
    return Array.from(bySource.values()).slice(0, 6);
  }, [results, isSearching]);

  const visibleSources = React.useMemo(() => {
    const liveStatusBySource = new Map(sourceRows.map((source) => [source.name.toLowerCase(), source.status]));
    return SOURCE_CATALOG.map((source, index) => ({
      ...source,
      status: (liveStatusBySource.get(source.name.toLowerCase()) || (isSearching ? 'Queued' : 'Included')) as SourcePanelStatus,
      catalogIndex: index,
    })).sort((a, b) => {
      const statusDelta = sourceStatusRank(a.status) - sourceStatusRank(b.status);
      if (statusDelta !== 0) return statusDelta;
      return a.catalogIndex - b.catalogIndex;
    });
  }, [isSearching, sourceRows]);

  const updateSessionAdvancedSetting = React.useCallback(
    (patch: Partial<JobSearchIntakeData>) => {
      if (!hasAdvancedAccess) return;
      setSessionFormData((prev) => ({ ...prev, ...patch }));
    },
    [hasAdvancedAccess],
  );

  const handleEditCriteria = React.useCallback(() => {
    navigate('/intake/job', {
      state: {
        prefill: sessionFormData,
        reusedFromSessionId: id,
      },
    });
  }, [id, navigate, sessionFormData]);

  const startedDateLabel = React.useMemo(() => {
    if (!startedAtMs) return new Date().toLocaleDateString();
    return new Date(startedAtMs).toLocaleDateString();
  }, [startedAtMs]);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 md:p-6 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-neutral-900" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">{`${primaryRole} ${locationLabel}`}</h1>
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${statusBadgeClass}`}>
                {status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                {status}
              </div>
              {searchPhase === 'background-monitoring' && (
                <div className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700">
                  Background Sync
                </div>
              )}
            </div>
            <p className="text-xs md:text-sm text-neutral-500 flex items-center gap-2">
              <Search size={14} />
              ID: {id} • Started {startedDateLabel} • Elapsed {formatTime(elapsedTime)}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {status === 'running' && searchPhase !== 'background-monitoring' && (
              <button
                onClick={handlePause}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-lg font-bold hover:bg-amber-100 transition-all min-h-[44px]"
              >
                <Pause size={18} />
                <span className="md:hidden lg:inline">Pause</span>
              </button>
            )}

            {status === 'running' && searchPhase === 'background-monitoring' && (
              <div className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-sky-50 text-sky-700 rounded-lg font-bold min-h-[44px]">
                <Loader2 size={18} className="animate-spin" />
                <span className="md:hidden lg:inline">Background</span>
              </div>
            )}

            {status === 'paused' && (
              <button
                onClick={() => void handleResume()}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg font-bold hover:bg-emerald-100 transition-all min-h-[44px]"
              >
                <Play size={18} />
                <span className="md:hidden lg:inline">Resume</span>
              </button>
            )}

            {(status === 'completed' || status === 'error') && (
              <div className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-500 rounded-lg font-bold min-h-[44px]">
                <CheckCircle2 size={18} />
                <span className="md:hidden lg:inline">{status === 'error' ? 'Error' : 'Completed'}</span>
              </div>
            )}

            <button
              onClick={() => void handleStop()}
              disabled={status === 'completed' || status === 'error'}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-600 rounded-lg font-bold hover:bg-neutral-200 transition-all min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Square size={18} />
              <span className="md:hidden lg:inline">Stop</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-widest">
                <Filter size={14} />
                Search Panel
              </div>
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${planBadgeClass(subscriptionTier)}`}>
                {subscriptionTier === 'free' ? <Lock size={11} /> : <Crown size={11} />}
                {planLabel(subscriptionTier)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
              {[
                { id: 'filters' as const, label: 'Live Filters' },
                { id: 'sources' as const, label: 'Sources' },
              ].map((tab) => {
                const isActive = sidebarTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSidebarTab(tab.id)}
                    className={`rounded-lg px-3 py-2 text-sm font-bold transition-all ${
                      isActive ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {sidebarTab === 'filters' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="pr-3">
                    <h4 className="font-bold text-neutral-900">Expand search</h4>
                    <p className="text-sm text-neutral-500">Wider discovery before ranking.</p>
                  </div>
                  <button
                    type="button"
                    disabled={!hasAdvancedAccess}
                    onClick={() =>
                      updateSessionAdvancedSetting({
                        expandSearch: !(sessionFormData.expandSearch ?? true),
                      })
                    }
                    className={`relative h-6 w-12 rounded-full transition-all ${(sessionFormData.expandSearch ?? true) ? 'bg-neutral-900' : 'bg-neutral-200'} ${!hasAdvancedAccess ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${(sessionFormData.expandSearch ?? true) ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="pr-3">
                    <h4 className="font-bold text-neutral-900">Visa sponsorship only</h4>
                    <p className="text-sm text-neutral-500">Save this preference for the next search.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSessionFormData((prev) => ({
                        ...prev,
                        visaSponsorship: !prev.visaSponsorship,
                      }))
                    }
                    className={`relative h-6 w-12 rounded-full transition-all ${sessionFormData.visaSponsorship ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${sessionFormData.visaSponsorship ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="pr-3">
                    <h4 className="font-bold text-neutral-900">Strict matching</h4>
                    <p className="text-sm text-neutral-500">Exact role titles instead of broader intent.</p>
                  </div>
                  <button
                    type="button"
                    disabled={!hasAdvancedAccess}
                    onClick={() =>
                      updateSessionAdvancedSetting({
                        strictMatching: !Boolean(sessionFormData.strictMatching),
                      })
                    }
                    className={`relative h-6 w-12 rounded-full transition-all ${sessionFormData.strictMatching ? 'bg-neutral-900' : 'bg-neutral-200'} ${!hasAdvancedAccess ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${sessionFormData.strictMatching ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-neutral-900">Source coverage</h4>
                      <p className="text-sm text-neutral-500">Tighter regional scan or full global coverage.</p>
                    </div>
                    {!hasAdvancedAccess && <Lock size={14} className="text-neutral-400" />}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      { value: 'regional', label: 'Regional' },
                      { value: 'global', label: 'Global' },
                    ].map((option) => {
                      const active = (sessionFormData.sourceScope || 'global') === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={!hasAdvancedAccess}
                          onClick={() => updateSessionAdvancedSetting({ sourceScope: option.value as JobSearchIntakeData['sourceScope'] })}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                            active
                              ? 'border-neutral-900 bg-neutral-900 text-white'
                              : hasAdvancedAccess
                              ? 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'
                              : 'border-neutral-200 bg-white text-neutral-400 cursor-not-allowed'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Sources</h3>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    {hasAdvancedAccess ? 'Managed by plan' : 'Read only'}
                  </span>
                </div>
                {visibleSources.slice(0, 6).map((source) => (
                  <div key={source.name} className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                    <div className="min-w-0">
                      <span className="block text-sm font-medium text-neutral-700">{source.name}</span>
                      <span className="block text-[11px] text-neutral-400 truncate">{source.domain}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {source.status === 'Searching' && <Loader2 size={12} className="animate-spin text-neutral-900" />}
                      {source.status === 'Completed' && <CheckCircle2 size={12} className="text-emerald-600" />}
                      {source.status === 'Failed' && <AlertCircle size={12} className="text-red-500" />}
                      <span
                        className={`text-[10px] font-bold uppercase ${
                          source.status === 'Searching'
                            ? 'text-neutral-900'
                            : source.status === 'Completed'
                            ? 'text-emerald-600'
                            : source.status === 'Failed'
                            ? 'text-red-500'
                            : source.status === 'Queued'
                            ? 'text-amber-700'
                            : 'text-sky-700'
                        }`}
                      >
                        {source.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-6 border-t border-neutral-100 space-y-3">
              {!hasAdvancedAccess && (
                <p className="text-xs text-neutral-500">Advanced filters stay locked until the account exposes Pro access.</p>
              )}
              <button
                type="button"
                onClick={handleEditCriteria}
                className="w-full py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-bold hover:bg-neutral-800 transition-all"
              >
                Edit Criteria
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-neutral-900">Live Activity Feed</h3>
              <button
                type="button"
                onClick={() => setIsMobileActivityCollapsed((prev) => !prev)}
                className="inline-flex lg:hidden items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neutral-600"
              >
                {isMobileActivityCollapsed ? (
                  <>
                    Show
                    <ChevronDown size={12} />
                  </>
                ) : (
                  <>
                    Hide
                    <ChevronUp size={12} />
                  </>
                )}
              </button>
            </div>
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
              {isMobileActivityCollapsed ? 'Hidden on mobile' : 'Real-time transparency'}
            </span>
          </div>

          {isMobileActivityCollapsed ? (
            <div className="lg:hidden rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Activity hidden</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    Live updates are still running. Show the feed any time if you want to inspect the search timeline.
                  </p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">
                  {hiddenTimelineCount} update{hiddenTimelineCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          ) : null}

          <div className={`relative space-y-4 ${timeline.length > 1 ? 'before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-px before:bg-neutral-200' : ''} ${isMobileActivityCollapsed ? 'hidden lg:block' : ''}`}>
            <AnimatePresence initial={false}>
              {timeline.length === 0 ? (
                <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
                  <Loader2 size={24} className="animate-spin text-neutral-900 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">Initializing search agent...</p>
                </div>
              ) : (
                timeline.map((item) => {
                  const borderClass =
                    item.severity === 'error'
                      ? 'border-red-200'
                      : item.severity === 'warning'
                      ? 'border-amber-200'
                      : item.severity === 'success'
                      ? 'border-emerald-200'
                      : 'border-neutral-200';
                  const dotClass =
                    item.severity === 'error'
                      ? 'border-red-500'
                      : item.severity === 'warning'
                      ? 'border-amber-500'
                      : item.severity === 'success'
                      ? 'border-emerald-500'
                      : 'border-neutral-900';

                  return (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative pl-10">
                      <div className={`absolute left-3.5 top-1.5 w-3 h-3 rounded-full bg-white border-2 z-10 ${dotClass}`} />
                      <div className={`bg-white border rounded-xl p-4 shadow-sm hover:border-neutral-400 transition-all ${borderClass}`}>
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-sm font-bold text-neutral-900">{item.title}</h4>
                          <span className="text-[10px] font-mono text-neutral-400">{item.timestamp}</span>
                        </div>
                        <p className="text-xs text-neutral-500 leading-relaxed">{item.description}</p>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          {cacheState && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <Loader2 size={18} className={`mt-0.5 text-amber-700 ${cacheState.refreshing ? 'animate-spin' : ''}`} />
              <div>
                <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  {cacheState.refreshing ? 'Showing saved results while refreshing' : 'Saved results restored'}
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  {cacheState.mode === 'intent' ? 'Matched a similar recent search' : 'Matched the same recent search'} from{' '}
                  {formatCacheAge(cacheState.ageMs)}.
                </p>
              </div>
            </div>
          )}

          {isSearching && (
            <div className="p-4 rounded-xl bg-neutral-100 border border-neutral-200 flex items-start gap-3">
              <Loader2 size={18} className="animate-spin text-neutral-900 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-neutral-800 uppercase tracking-wide">
                  {searchPhase === 'background-monitoring'
                    ? 'Search continues in background...'
                    : 'Searching for more opportunities...'}
                </p>
                <p className="text-xs text-neutral-600 mt-1">
                  {searchPhase === 'background-monitoring'
                    ? 'Live streaming has ended for this session. Results are refreshing from backend snapshots.'
                    : 'Live queue is active. New cards will appear below in order.'}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4">
              {['all', 'shortlisted', 'saved'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as 'all' | 'shortlisted' | 'saved')}
                  className={`text-sm font-bold capitalize transition-all pb-1 border-b-2 ${
                    activeTab === tab ? 'text-neutral-900 border-neutral-900' : 'text-neutral-400 border-transparent hover:text-neutral-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{visibleResults.length} Found</span>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-neutral-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Result Filters</span>
              </div>
              {(resultFitFilter !== 'all' || resultStageFilter !== 'all' || resultSourceFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setResultFitFilter('all');
                    setResultStageFilter('all');
                    setResultSourceFilter('all');
                  }}
                  className="text-xs font-bold text-neutral-600 transition-colors hover:text-neutral-900"
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-neutral-400">Fit</span>
                <select
                  value={resultFitFilter}
                  onChange={(event) => setResultFitFilter(event.target.value as ResultFitFilter)}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  <option value="all">All fit levels</option>
                  <option value="High">High fit</option>
                  <option value="Medium">Medium fit</option>
                  <option value="Low">Low fit</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-neutral-400">Stage</span>
                <select
                  value={resultStageFilter}
                  onChange={(event) => setResultStageFilter(event.target.value as ResultStageFilter)}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  <option value="all">All stages</option>
                  <option value="ready">Ready / Verified</option>
                  <option value="extracting">Extracting</option>
                  <option value="queued">Queued</option>
                  <option value="failed">Failed</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-neutral-400">Source</span>
                <select
                  value={resultSourceFilter}
                  onChange={(event) => setResultSourceFilter(event.target.value)}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  <option value="all">All sources</option>
                  {availableResultSources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {visibleResults.length === 0 && isSearching ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((skeleton) => (
                    <div key={skeleton} className="bg-white border border-neutral-100 rounded-xl p-5 animate-pulse space-y-3">
                      <div className="h-4 bg-neutral-100 rounded w-3/4" />
                      <div className="h-3 bg-neutral-100 rounded w-1/2" />
                      <div className="h-5 bg-neutral-100 rounded w-28" />
                    </div>
                  ))}
                </div>
              ) : visibleResults.length === 0 ? (
                <div className="bg-white border border-neutral-200 rounded-xl p-6 text-center">
                  <p className="text-sm font-medium text-neutral-700">
                    {resultFitFilter !== 'all' || resultStageFilter !== 'all' || resultSourceFilter !== 'all'
                      ? 'No opportunities match the current filters.'
                      : 'No opportunities in this tab yet.'}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {resultFitFilter !== 'all' || resultStageFilter !== 'all' || resultSourceFilter !== 'all'
                      ? 'Adjust or clear the filters above to widen the result list.'
                      : 'Try switching to “All” to view the current results.'}
                  </p>
                </div>
              ) : (
                visibleResults.map((result) => {
                  const isSaved = savedJobKeys.has(resultIdentity(result));
                  const isSaving = savingJobIds.has(result.id);

                  return (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all group"
                    >
                    <div className="flex justify-between items-start mb-3 gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="font-bold text-neutral-900 group-hover:text-black transition-colors">{result.title}</h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${queueClass(result.queueStatus)}`}>
                            {queueLabel(result.queueStatus)}
                          </span>
                          {result.sourceVerified && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                              Verified
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-500">
                          {result.organization} • {result.location}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                          Source: {result.sourceName} • {result.sourceDomain}
                        </p>
                        {result.seenOn && result.seenOn.length > 1 && (
                          <p className="text-xs text-emerald-700 mt-2 font-medium">
                            Seen on {result.seenOn.length} sources: {result.seenOn.map((source) => source.sourceName).join(', ')}
                          </p>
                        )}
                      </div>
                      <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${fitClass(result.fitScore)}`}>{result.fitScore} Fit</div>
                    </div>

                    {result.snippet && <p className="text-xs text-neutral-600 mb-3 line-clamp-2">{result.snippet}</p>}

                    <div className="flex flex-wrap gap-2 mb-4">
                      {result.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 bg-neutral-50 text-neutral-500 rounded text-[10px] font-medium border border-neutral-100">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-neutral-50 gap-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleSaveJob(result, 'saved')}
                          disabled={isSaving}
                          className={`p-2 rounded-lg transition-all ${isSaved ? 'text-neutral-900 bg-neutral-100' : 'text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100'} ${isSaving ? 'opacity-60 cursor-not-allowed' : ''}`}
                          title={isSaved ? 'Saved to profile' : 'Save to profile'}
                        >
                          <Bookmark size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSaveJob(result, 'shortlisted')}
                          disabled={isSaving}
                          className={`p-2 rounded-lg transition-all ${result.status === 'shortlisted' ? 'text-emerald-700 bg-emerald-50' : 'text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50'} ${isSaving ? 'opacity-60 cursor-not-allowed' : ''}`}
                          title={result.status === 'shortlisted' ? 'Shortlisted and saved' : 'Shortlist and save'}
                        >
                          <CheckCircle2 size={16} />
                        </button>
                        <button
                          onClick={() => setSelectedJobId(result.id)}
                          className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all"
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                      <a
                        href={result.link || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 text-neutral-900 rounded-lg text-xs font-bold hover:bg-neutral-200 transition-all min-h-[40px]"
                      >
                        Open Link
                        <ExternalLink size={12} />
                      </a>
                    </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <JobDetailsModal job={selectedJob} onClose={() => setSelectedJobId(null)} />
    </div>
  );
}
