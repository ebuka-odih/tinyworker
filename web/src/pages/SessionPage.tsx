import React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  Play,
  Pause,
  Square,
  ChevronRight,
  ExternalLink,
  Bookmark,
  CheckCircle2,
  Loader2,
  Filter,
  Globe,
  Search,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TimelineItem, SearchResult, TimelineSeverity, TimelineStatus } from '../types';
import { searchJobs } from '../services/jobSearchApi';

type IntakeData = {
  roles?: string[];
  location?: string;
  visaSponsorship?: boolean;
  remote?: boolean;
};

type SessionLocationState = {
  formData?: IntakeData;
};

type SearchPhase = 'initializing' | 'fetching' | 'post-processing' | 'completed' | 'error';
type AbortReason = 'pause' | 'stop' | 'timeout' | 'cleanup';

type AddTimelineEventOptions = {
  details?: string;
  detailLines?: string[];
  status?: TimelineStatus;
  severity?: TimelineSeverity;
  isExpanded?: boolean;
};

const COUNTRY_CODES: Record<string, string> = {
  Germany: 'DE',
  'United Kingdom': 'GB',
  Canada: 'CA',
  'United States': 'US',
  Netherlands: 'NL',
};

const FALLBACK_RESULTS: SearchResult[] = [
  {
    id: 'fallback-1',
    title: 'Senior Backend Engineer',
    organization: 'TechFlow GmbH',
    location: 'Berlin, Germany',
    fitScore: 'High',
    tags: ['Visa Sponsorship', 'Hybrid', 'Senior'],
    link: '#',
    status: 'new',
  },
  {
    id: 'fallback-2',
    title: 'Full Stack Developer',
    organization: 'EduGlobal',
    location: 'Munich, Germany',
    fitScore: 'Medium',
    tags: ['Visa Sponsorship', 'On-site', 'Mid-level'],
    link: '#',
    status: 'new',
  },
  {
    id: 'fallback-3',
    title: 'Cloud Architect',
    organization: 'DataScale',
    location: 'Remote (Germany)',
    fitScore: 'High',
    tags: ['Remote', 'High Salary', 'Senior'],
    link: '#',
    status: 'new',
  },
];

const INITIAL_EVENT_DELAY_MS = 700;
const KEYWORD_EVENT_DELAY_MS = 1600;
const QUERY_EVENT_DELAY_MS = 2600;
const FETCH_DELAY_MS = 3200;
const MAX_SEARCH_RUNTIME_MS = 90_000;

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const state = (location.state || {}) as SessionLocationState;
  const formData = state.formData || {};
  const roles = formData.roles || [];
  const primaryRole = roles[0] || 'Backend Roles';
  const locationLabel = formData.location || 'Global';
  const countryCode = formData.location ? COUNTRY_CODES[formData.location] : undefined;
  const searchQuery = React.useMemo(() => {
    const rolePart = roles.length ? roles.join(' OR ') : 'backend engineer';
    const sponsorshipPart = formData.visaSponsorship ? 'with visa sponsorship' : '';
    const remotePart = formData.remote ? 'remote' : '';
    return [rolePart, 'jobs in', locationLabel, sponsorshipPart, remotePart].filter(Boolean).join(' ');
  }, [roles, formData.visaSponsorship, formData.remote, locationLabel]);

  const [status, setStatus] = React.useState<'running' | 'paused' | 'completed'>('running');
  const [searchPhase, setSearchPhase] = React.useState<SearchPhase>('initializing');
  const [hasCompletedSearch, setHasCompletedSearch] = React.useState(false);
  const [elapsedTime, setElapsedTime] = React.useState(0);
  const [timeline, setTimeline] = React.useState<TimelineItem[]>([]);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [activeTab, setActiveTab] = React.useState<'all' | 'shortlisted' | 'saved'>('all');

  const runIdRef = React.useRef(0);
  const fetchControllerRef = React.useRef<AbortController | null>(null);
  const abortReasonRef = React.useRef<AbortReason | null>(null);
  const scheduledTimeoutsRef = React.useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const runtimeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScheduledTimeouts = React.useCallback(() => {
    scheduledTimeoutsRef.current.forEach(clearTimeout);
    scheduledTimeoutsRef.current = [];

    if (runtimeTimeoutRef.current) {
      clearTimeout(runtimeTimeoutRef.current);
      runtimeTimeoutRef.current = null;
    }
  }, []);

  const abortInFlightFetch = React.useCallback((reason: AbortReason) => {
    if (!fetchControllerRef.current) return;

    if (!abortReasonRef.current || reason !== 'cleanup') {
      abortReasonRef.current = reason;
    }

    fetchControllerRef.current.abort();
    fetchControllerRef.current = null;
  }, []);

  const addTimelineEvent = React.useCallback((title: string, description: string, options: AddTimelineEventOptions = {}) => {
    setTimeline((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        title,
        description,
        details: options.details,
        detailLines: options.detailLines,
        status: options.status,
        severity: options.severity,
        isExpanded: options.isExpanded,
      },
      ...prev,
    ]);
  }, []);

  const toggleTimelineDetails = React.useCallback((itemId: string) => {
    setTimeline((prev) => prev.map((item) => (item.id === itemId ? { ...item, isExpanded: !item.isExpanded } : item)));
  }, []);

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (status === 'running' && !hasCompletedSearch) {
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status, hasCompletedSearch]);

  React.useEffect(() => {
    if (status !== 'running' || hasCompletedSearch) return;

    const currentRunId = runIdRef.current + 1;
    runIdRef.current = currentRunId;
    abortReasonRef.current = null;

    clearScheduledTimeouts();
    abortInFlightFetch('cleanup');
    setSearchPhase('initializing');
    setResults([]);

    const schedule = (cb: () => void, delay: number) => {
      const timeout = setTimeout(() => {
        if (runIdRef.current !== currentRunId) return;
        cb();
      }, delay);
      scheduledTimeoutsRef.current.push(timeout);
    };

    schedule(() => {
      addTimelineEvent('Initializing search agent', `Setting up workspace for ${primaryRole} search in ${locationLabel}.`, {
        status: 'running',
        severity: 'info',
        details: 'Workspace context initialized for this session.',
        detailLines: [`Session ID: ${id || 'unknown'}`, `Role focus: ${primaryRole}`, `Location target: ${locationLabel}`],
      });
    }, INITIAL_EVENT_DELAY_MS);

    schedule(() => {
      addTimelineEvent('Extracting keywords from CV', `Target roles: ${roles.join(', ') || primaryRole}.`, {
        status: 'running',
        severity: 'info',
        details: 'Profile and role signals extracted from intake and CV.',
        detailLines: [
          `Primary role: ${primaryRole}`,
          `Visa sponsorship required: ${formData.visaSponsorship ? 'Yes' : 'No'}`,
          `Remote preference: ${formData.remote ? 'Yes' : 'No'}`,
        ],
      });
    }, KEYWORD_EVENT_DELAY_MS);

    schedule(() => {
      addTimelineEvent('Querying Valyu Search API', `Searching: "${searchQuery}".`, {
        status: 'running',
        severity: 'info',
        details: 'Live search request sent to Valyu API.',
        detailLines: [
          `Query: ${searchQuery}`,
          `Country code: ${countryCode || 'Global'}`,
          'Source: Valyu web search',
          'Max results: 12',
        ],
      });
    }, QUERY_EVENT_DELAY_MS);

    runtimeTimeoutRef.current = setTimeout(() => {
      if (runIdRef.current !== currentRunId) return;
      abortInFlightFetch('timeout');
    }, MAX_SEARCH_RUNTIME_MS);

    schedule(async () => {
      if (runIdRef.current !== currentRunId) return;

      setSearchPhase('fetching');
      const controller = new AbortController();
      fetchControllerRef.current = controller;

      try {
        const fetched = await searchJobs({
          query: searchQuery,
          countryCode,
          maxNumResults: 12,
          signal: controller.signal,
        });

        if (runIdRef.current !== currentRunId) return;

        setSearchPhase('post-processing');

        const usedFallback = fetched.length === 0;
        const nextResults = usedFallback ? FALLBACK_RESULTS : fetched;

        setResults(nextResults);

        addTimelineEvent(
          usedFallback ? 'No live opportunities returned' : `Found ${nextResults.length} potential matches`,
          usedFallback
            ? 'Valyu returned no opportunities. Showing cached sample opportunities for this session.'
            : 'Filtering results by relevance and ranking opportunities.',
          {
            status: 'running',
            severity: usedFallback ? 'warning' : 'success',
            details: usedFallback
              ? 'Fallback mode was used because no opportunities were returned by live search.'
              : 'Live opportunities returned successfully and rendered.',
            detailLines: [
              `Query: ${searchQuery}`,
              `Country code: ${countryCode || 'Global'}`,
              `Live results: ${fetched.length}`,
              `Fallback used: ${usedFallback ? 'Yes' : 'No'}`,
            ],
            isExpanded: usedFallback,
          },
        );

        addTimelineEvent('Ranking opportunities', 'Calculated fit score based on title and source relevance.', {
          status: 'completed',
          severity: 'success',
          details: 'Ranking completed for visible opportunities.',
          detailLines: [
            `Displayed results: ${nextResults.length}`,
            `Top role: ${nextResults[0]?.title || 'N/A'}`,
            `Top fit: ${nextResults[0]?.fitScore || 'N/A'}`,
          ],
        });

        setSearchPhase('completed');
        setStatus('completed');
        setHasCompletedSearch(true);
      } catch (error) {
        if (runIdRef.current !== currentRunId) return;

        const abortReason = abortReasonRef.current;
        abortReasonRef.current = null;

        if (abortReason === 'pause' || abortReason === 'stop' || abortReason === 'cleanup') {
          return;
        }

        setResults(FALLBACK_RESULTS);

        if (abortReason === 'timeout') {
          setSearchPhase('error');
          addTimelineEvent('Search request timed out', 'Live search exceeded the runtime limit. Fallback opportunities were loaded.', {
            status: 'failed',
            severity: 'error',
            details: `Timed out after ${Math.round(MAX_SEARCH_RUNTIME_MS / 1000)} seconds.`,
            detailLines: [
              `Query: ${searchQuery}`,
              `Country code: ${countryCode || 'Global'}`,
              'Action: fallback opportunities shown',
            ],
            isExpanded: true,
          });
          setStatus('completed');
          setHasCompletedSearch(true);
          return;
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        setSearchPhase('error');
        addTimelineEvent('Valyu API unavailable', 'Falling back to cached sample opportunities for this session.', {
          status: 'failed',
          severity: 'warning',
          details: message,
          detailLines: [
            `Query: ${searchQuery}`,
            `Country code: ${countryCode || 'Global'}`,
            'Action: fallback opportunities shown',
          ],
          isExpanded: true,
        });

        setStatus('completed');
        setHasCompletedSearch(true);
      } finally {
        if (runIdRef.current === currentRunId) {
          fetchControllerRef.current = null;
          clearScheduledTimeouts();
        }
      }
    }, FETCH_DELAY_MS);

    return () => {
      clearScheduledTimeouts();
      abortInFlightFetch('cleanup');
    };
  }, [
    status,
    hasCompletedSearch,
    clearScheduledTimeouts,
    abortInFlightFetch,
    addTimelineEvent,
    searchQuery,
    countryCode,
    primaryRole,
    locationLabel,
    roles,
    formData.visaSponsorship,
    formData.remote,
    id,
  ]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePause = () => {
    if (status !== 'running' || hasCompletedSearch) return;

    runIdRef.current += 1;
    clearScheduledTimeouts();
    abortInFlightFetch('pause');

    setStatus('paused');
    setSearchPhase('initializing');

    addTimelineEvent('Search paused', 'Live search has been paused. Resume to continue.', {
      status: 'queued',
      severity: 'warning',
      details: 'The in-flight request was canceled by user action.',
      detailLines: [`Elapsed: ${formatTime(elapsedTime)}`, `Results so far: ${results.length}`],
    });
  };

  const handleResume = () => {
    if (status !== 'paused' || hasCompletedSearch) return;

    addTimelineEvent('Resuming search', 'Reconnecting to live sources and continuing this session.', {
      status: 'running',
      severity: 'info',
      details: 'A fresh search request will be started.',
      detailLines: [`Query: ${searchQuery}`, `Country code: ${countryCode || 'Global'}`],
    });

    setStatus('running');
  };

  const handleStop = () => {
    runIdRef.current += 1;
    clearScheduledTimeouts();
    abortInFlightFetch('stop');

    if (!hasCompletedSearch) {
      addTimelineEvent('Search stopped', 'Search session ended manually.', {
        status: 'completed',
        severity: 'warning',
        details: 'The live search loop was stopped by user action.',
        detailLines: [`Elapsed: ${formatTime(elapsedTime)}`, `Results shown: ${results.length}`],
      });
    }

    setStatus('completed');
    setSearchPhase('completed');
    setHasCompletedSearch(true);
  };

  const isSearching =
    status === 'running' &&
    !hasCompletedSearch &&
    (searchPhase === 'initializing' || searchPhase === 'fetching' || searchPhase === 'post-processing');

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
      : 'bg-neutral-100 text-neutral-600';

  const sourceRows =
    searchPhase === 'error'
      ? [
          { name: 'Valyu Search', status: 'Unavailable' },
          { name: 'Web Sources', status: 'Queued' },
          { name: 'News Index', status: 'Queued' },
          { name: 'Proprietary', status: 'Queued' },
        ]
      : isSearching
      ? [
          { name: 'Valyu Search', status: 'Searching' },
          { name: 'Web Sources', status: 'Searching' },
          { name: 'News Index', status: 'Queued' },
          { name: 'Proprietary', status: 'Queued' },
        ]
      : [
          { name: 'Valyu Search', status: 'Completed' },
          { name: 'Web Sources', status: 'Completed' },
          { name: 'News Index', status: 'Queued' },
          { name: 'Proprietary', status: 'Queued' },
        ];

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
            </div>
            <p className="text-xs md:text-sm text-neutral-500 flex items-center gap-2">
              <Search size={14} />
              ID: {id} • Started {new Date().toLocaleDateString()} • Elapsed {formatTime(elapsedTime)}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {status === 'running' && (
              <button
                onClick={handlePause}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-lg font-bold hover:bg-amber-100 transition-all min-h-[44px]"
              >
                <Pause size={18} />
                <span className="md:hidden lg:inline">Pause</span>
              </button>
            )}

            {status === 'paused' && (
              <button
                onClick={handleResume}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg font-bold hover:bg-emerald-100 transition-all min-h-[44px]"
              >
                <Play size={18} />
                <span className="md:hidden lg:inline">Resume</span>
              </button>
            )}

            {status === 'completed' && (
              <div className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-500 rounded-lg font-bold min-h-[44px]">
                <CheckCircle2 size={18} />
                <span className="md:hidden lg:inline">Completed</span>
              </div>
            )}

            <button
              onClick={handleStop}
              disabled={status === 'completed'}
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
                  { label: 'Visa sponsorship only', active: true },
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
                  <div key={source.name} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-600">{source.name}</span>
                    <div className="flex items-center gap-1.5">
                      {source.status === 'Searching' && <Loader2 size={12} className="animate-spin text-neutral-900" />}
                      {source.status === 'Completed' && <CheckCircle2 size={12} className="text-emerald-600" />}
                      {source.status === 'Unavailable' && <AlertCircle size={12} className="text-red-500" />}
                      <span
                        className={`text-[10px] font-bold uppercase ${
                          source.status === 'Searching'
                            ? 'text-neutral-900'
                            : source.status === 'Completed'
                            ? 'text-emerald-600'
                            : source.status === 'Unavailable'
                            ? 'text-red-500'
                            : 'text-neutral-400'
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
                  const hasDetails = Boolean(item.details || (item.detailLines && item.detailLines.length > 0));
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
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative pl-10"
                    >
                      <div className={`absolute left-3.5 top-1.5 w-3 h-3 rounded-full bg-white border-2 z-10 ${dotClass}`} />
                      <div className={`bg-white border rounded-xl p-4 shadow-sm hover:border-neutral-400 transition-all ${borderClass}`}>
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-sm font-bold text-neutral-900">{item.title}</h4>
                          <span className="text-[10px] font-mono text-neutral-400">{item.timestamp}</span>
                        </div>
                        <p className="text-xs text-neutral-500 leading-relaxed">{item.description}</p>

                        {hasDetails && (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleTimelineDetails(item.id)}
                              className="mt-3 flex items-center gap-1 text-[10px] font-bold text-neutral-900 hover:text-black transition-all"
                            >
                              {item.isExpanded ? 'Hide details' : 'View details'}
                              <ChevronRight size={10} className={`transition-transform ${item.isExpanded ? 'rotate-90' : ''}`} />
                            </button>

                            {item.isExpanded && (
                              <div className="mt-3 p-3 rounded-lg border border-neutral-200 bg-neutral-50 space-y-2">
                                {item.details && <p className="text-[11px] text-neutral-700">{item.details}</p>}
                                {item.detailLines?.map((line, lineIndex) => (
                                  <p key={`${item.id}-${lineIndex}`} className="text-[11px] text-neutral-500">
                                    {line}
                                  </p>
                                ))}
                              </div>
                            )}
                          </>
                        )}
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
                <p className="text-xs font-bold text-neutral-800 uppercase tracking-wide">Searching for more opportunities...</p>
                <p className="text-xs text-neutral-600 mt-1">Live fetch is active. Results will appear below this card.</p>
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
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{visibleResults.length} Found</span>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {results.length === 0 && isSearching ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((skeleton) => (
                    <div key={skeleton} className="bg-white border border-neutral-100 rounded-xl p-5 animate-pulse space-y-3">
                      <div className="h-4 bg-neutral-100 rounded w-3/4" />
                      <div className="h-3 bg-neutral-100 rounded w-1/2" />
                      <div className="flex gap-2">
                        <div className="h-5 bg-neutral-100 rounded w-16" />
                        <div className="h-5 bg-neutral-100 rounded w-16" />
                      </div>
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
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-neutral-900 group-hover:text-black transition-colors">{result.title}</h4>
                          {result.isSuspicious && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-bold border border-red-100">
                              <AlertCircle size={10} />
                              Suspicious
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-500">
                          {result.organization} • {result.location}
                        </p>
                      </div>
                      <div
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          result.fitScore === 'High' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        {result.fitScore} Fit
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {result.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-neutral-50 text-neutral-500 rounded text-[10px] font-medium border border-neutral-100"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-neutral-50">
                      <div className="flex items-center gap-1">
                        <button className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all" title="Save">
                          <Bookmark size={16} />
                        </button>
                        <button className="p-2 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Shortlist">
                          <CheckCircle2 size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setResults((prev) =>
                              prev.map((item) => (item.id === result.id ? { ...item, isSuspicious: !item.isSuspicious } : item)),
                            );
                          }}
                          className={`p-2 rounded-lg transition-all ${
                            result.isSuspicious ? 'text-red-600 bg-red-50' : 'text-neutral-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title="Flag as Suspicious"
                        >
                          <AlertCircle size={16} />
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
    </div>
  );
}
