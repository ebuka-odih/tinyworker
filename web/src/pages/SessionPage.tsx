import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  Play,
  Pause,
  Square,
  ExternalLink,
  Bookmark,
  CheckCircle2,
  Loader2,
  Filter,
  Globe,
  Search,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { JobQueueStatus, SearchResult, TimelineItem, TimelineSeverity, TimelineStatus } from '../types';
import {
  SearchRunEvent,
  SearchRunSnapshot,
  connectJobSearchRunStream,
  getJobSearchRunSnapshot,
  startJobSearchRun,
  stopJobSearchRun,
} from '../services/jobSearchStreamApi';
import { JobDetailsModal } from '../components/JobDetailsModal';

type IntakeData = {
  roles?: string[];
  location?: string;
  visaSponsorship?: boolean;
  remote?: boolean;
};

type SessionLocationState = {
  formData?: IntakeData;
};

type SearchPhase = 'initializing' | 'streaming' | 'background-monitoring' | 'completed' | 'error';

const COUNTRY_CODES: Record<string, string> = {
  Germany: 'DE',
  'United Kingdom': 'GB',
  Canada: 'CA',
  'United States': 'US',
  Netherlands: 'NL',
};

const MAX_SEARCH_RUNTIME_MS = 90_000;

const SNAPSHOT_POLL_INTERVAL_MS = 5_000;

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

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const state = (location.state || {}) as SessionLocationState;
  const formData = state.formData || {};
  const roles = formData.roles || [];
  const primaryRole = roles[0] || 'Backend Roles';
  const locationLabel = formData.location || 'Any location';
  const countryCode = formData.location && formData.location !== 'Any location' ? COUNTRY_CODES[formData.location] : undefined;
  const searchQuery = React.useMemo(() => {
    const rolePart = roles.length ? roles.join(' OR ') : 'backend engineer';
    const sponsorshipPart = formData.visaSponsorship ? 'with visa sponsorship' : '';
    const remotePart = formData.remote ? 'remote' : '';
    return [rolePart, 'jobs in', locationLabel, sponsorshipPart, remotePart].filter(Boolean).join(' ');
  }, [roles, formData.visaSponsorship, formData.remote, locationLabel]);

  const [status, setStatus] = React.useState<'running' | 'paused' | 'completed' | 'error'>('running');
  const [searchPhase, setSearchPhase] = React.useState<SearchPhase>('initializing');
  const [elapsedTime, setElapsedTime] = React.useState(0);
  const [timeline, setTimeline] = React.useState<TimelineItem[]>([]);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [activeTab, setActiveTab] = React.useState<'all' | 'shortlisted' | 'saved'>('all');
  const [runId, setRunId] = React.useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);

  const streamRef = React.useRef<{ close: () => void } | null>(null);
  const snapshotPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const snapshotRequestInFlightRef = React.useRef(false);
  const isPausedRef = React.useRef(false);
  const isCompletedRef = React.useRef(false);
  const eventQueueRef = React.useRef<SearchRunEvent[]>([]);
  const lastSequenceRef = React.useRef(0);
  const liveWindowTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStartedRef = React.useRef(false);
  const lastSnapshotStatusRef = React.useRef<string | null>(null);
  const lastSnapshotCountsRef = React.useRef({ ready: 0, failed: 0, queued: 0 });

  const selectedJob = React.useMemo(
    () => results.find((item) => item.id === selectedJobId) || null,
    [results, selectedJobId],
  );

  const closeStream = React.useCallback(() => {
    streamRef.current?.close();
    streamRef.current = null;
  }, []);

  const clearLiveWindowTimeout = React.useCallback(() => {
    if (liveWindowTimeoutRef.current) {
      clearTimeout(liveWindowTimeoutRef.current);
      liveWindowTimeoutRef.current = null;
    }
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
    clearLiveWindowTimeout();
    clearSnapshotPolling();
  }, [clearLiveWindowTimeout, clearSnapshotPolling, closeStream]);

  const addTimelineEvent = React.useCallback((title: string, description: string, severity: TimelineSeverity = 'info', eventStatus: TimelineStatus = 'running') => {
    setTimeline((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        title,
        description,
        severity,
        status: eventStatus,
      },
      ...prev,
    ]);
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
        next[existingIndex] = { ...next[existingIndex], ...incoming };
      } else {
        next.push(incoming);
      }
      return next.sort((a, b) => {
        const ap = typeof a.queuePosition === 'number' ? a.queuePosition : Number.MAX_SAFE_INTEGER;
        const bp = typeof b.queuePosition === 'number' ? b.queuePosition : Number.MAX_SAFE_INTEGER;
        if (ap !== bp) return ap - bp;
        return (b.relevance || 0) - (a.relevance || 0);
      });
    });
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
      setResults(snapshotResults);
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
        setSearchPhase('streaming');
        addTimelineEvent('Initializing search agent', 'Preparing verified sources and extraction queue.', 'info', 'running');
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
        addTimelineEvent('Job card ready', `${item.title} is ready from ${item.sourceName}.`, 'success', 'completed');
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
        finalizeRunState('completed', 'completed', 'Search completed', 'Queue finished and results are now stable.', 'success');
        return;
      }

      if (event.type === 'run_stopped') {
        finalizeRunState('completed', 'completed', 'Search stopped', 'Run was stopped manually.', 'warning');
        return;
      }

      if (event.type === 'run_error') {
        const details = String(event.payload?.message || 'Unknown search error');
        const isTimeout = String(event.payload?.code || '').toLowerCase() === 'timeout';
        finalizeRunState('error', 'error', isTimeout ? 'Run timeout' : 'Search error', details, isTimeout ? 'warning' : 'error');
      }
    },
    [addTimelineEvent, finalizeRunState, upsertResult],
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
        onError: () => {
          if (isCompletedRef.current) return;
          addTimelineEvent('Stream reconnecting', 'Live updates interrupted. Trying to reconnect.', 'warning', 'running');
        },
      });
    },
    [addTimelineEvent, applyRunEvent, applySnapshot, closeStream],
  );

  const startSnapshotPolling = React.useCallback(
    (searchRunId: string) => {
      clearSnapshotPolling();

      const poll = async () => {
        if (snapshotRequestInFlightRef.current || isCompletedRef.current) return;
        snapshotRequestInFlightRef.current = true;
        try {
          const snapshot = await getJobSearchRunSnapshot(searchRunId);
          applySnapshot(snapshot);
        } catch {
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
    [addTimelineEvent, applySnapshot, clearSnapshotPolling],
  );

  const handleStartFailure = React.useCallback(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Search run could not be started.';
      setResults([]);
      setStatus('error');
      setSearchPhase('error');
      isCompletedRef.current = true;
      clearRunActivity();
      addTimelineEvent('Search unavailable', message, 'error', 'failed');
    },
    [addTimelineEvent, clearRunActivity],
  );

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (status === 'running' && !isCompletedRef.current) {
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status]);

  React.useEffect(() => {
    isPausedRef.current = status === 'paused';
  }, [status]);

  React.useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    isCompletedRef.current = false;
    eventQueueRef.current = [];
    lastSnapshotStatusRef.current = null;
    lastSnapshotCountsRef.current = { ready: 0, failed: 0, queued: 0 };

    const start = async () => {
      setSearchPhase('initializing');
      addTimelineEvent('Starting search run', `Running: "${searchQuery}"`, 'info', 'running');
      try {
        const started = await startJobSearchRun({
          query: searchQuery,
          countryCode,
          maxNumResults: 12,
          sourceScope: 'global',
          remote: formData.remote,
          visaSponsorship: formData.visaSponsorship,
        });
        setRunId(started.runId);
        connectToRunStream(started.runId);

        liveWindowTimeoutRef.current = setTimeout(() => {
          if (isCompletedRef.current) return;
          closeStream();
          setStatus('running');
          setSearchPhase('background-monitoring');
          addTimelineEvent(
            'Live view timed out',
            `Live updates paused after ${Math.round(MAX_SEARCH_RUNTIME_MS / 1000)} seconds. Search continues in background and results will refresh automatically.`,
            'warning',
            'running',
          );
          startSnapshotPolling(started.runId);
        }, MAX_SEARCH_RUNTIME_MS);
      } catch (error) {
        handleStartFailure(error);
      }
    };

    void start();

    return () => {
      clearRunActivity();
    };
  }, [
    addTimelineEvent,
    clearRunActivity,
    closeStream,
    connectToRunStream,
    countryCode,
    formData.remote,
    formData.visaSponsorship,
    handleStartFailure,
    searchQuery,
    startSnapshotPolling,
  ]);

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
      const snapshot = await getJobSearchRunSnapshot(runId);
      applySnapshot(snapshot);
      connectToRunStream(runId);
    }
  };

  const handleStop = async () => {
    if (isCompletedRef.current) return;
    if (runId) {
      try {
        await stopJobSearchRun(runId);
      } catch {
        // Stop can race with completion; ignore transport errors.
      }
    }
    finalizeRunState('completed', 'completed', 'Search stopped', 'Search session ended manually.', 'warning');
  };

  const isSearching = (status === 'running' || status === 'paused') && !isCompletedRef.current;

  const visibleResults = React.useMemo(() => {
    if (activeTab === 'all') return results;
    if (activeTab === 'shortlisted') return results.filter((result) => result.status === 'shortlisted');
    return results.filter((result) => result.status === 'saved');
  }, [results, activeTab]);

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
              ID: {id} • Started {new Date().toLocaleDateString()} • Elapsed {formatTime(elapsedTime)}
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
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-6">
            <div>
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Filter size={14} />
                Live Filters
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Expand search', active: true },
                  { label: 'Visa sponsorship only', active: Boolean(formData.visaSponsorship) },
                  { label: 'Strict matching', active: false },
                ].map((filter) => (
                  <label key={filter.label} className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm font-medium text-neutral-600 group-hover:text-neutral-900">{filter.label}</span>
                    <div className={`w-8 h-4 rounded-full relative transition-all ${filter.active ? 'bg-neutral-900' : 'bg-neutral-200'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${filter.active ? 'left-4.5' : 'left-0.5'}`} />
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-100">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Globe size={14} />
                Sources
              </h3>
              <div className="space-y-3">
                {sourceRows.map((source) => (
                  <div key={source.name} className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-neutral-600">{source.name}</span>
                    <div className="flex items-center gap-1.5">
                      {source.status === 'Searching' && <Loader2 size={12} className="animate-spin text-neutral-900" />}
                      {source.status === 'Completed' && <CheckCircle2 size={12} className="text-emerald-600" />}
                      {source.status === 'Failed' && <AlertCircle size={12} className="text-red-500" />}
                      <span
                        className={`text-[10px] font-bold uppercase ${
                          source.status === 'Searching'
                            ? 'text-neutral-900'
                            : source.status === 'Completed'
                            ? 'text-emerald-600'
                            : 'text-red-500'
                        }`}
                      >
                        {source.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-100">
              <button className="w-full py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-bold hover:bg-neutral-800 transition-all">
                Edit Criteria
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-bold text-neutral-900">Live Activity Feed</h3>
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Real-time transparency</span>
          </div>

          <div className="space-y-4 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-px before:bg-neutral-200">
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
                  <p className="text-sm font-medium text-neutral-700">No opportunities in this tab yet.</p>
                  <p className="text-xs text-neutral-500 mt-1">Try switching to “All” to view the current results.</p>
                </div>
              ) : (
                visibleResults.map((result) => (
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
                        <button className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all" title="Save">
                          <Bookmark size={16} />
                        </button>
                        <button className="p-2 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Shortlist">
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
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <JobDetailsModal job={selectedJob} onClose={() => setSelectedJobId(null)} />
    </div>
  );
}
