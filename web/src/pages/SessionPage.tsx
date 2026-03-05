import React from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { 
  Play, Pause, Square, ChevronRight, ExternalLink, Bookmark, 
  CheckCircle2, Loader2, Filter, Globe, Search, AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TimelineItem, SearchResult } from '../types';
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

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const searchStartedRef = React.useRef(false);
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
  const [elapsedTime, setElapsedTime] = React.useState(0);
  const [timeline, setTimeline] = React.useState<TimelineItem[]>([]);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [activeTab, setActiveTab] = React.useState<'all' | 'shortlisted' | 'saved'>('all');

  const addTimelineEvent = React.useCallback((title: string, description: string) => {
    setTimeline((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        title,
        description,
      },
      ...prev,
    ]);
  }, []);

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (status === 'running') {
      timer = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status]);

  React.useEffect(() => {
    if (status !== 'running' || searchStartedRef.current) return;
    searchStartedRef.current = true;

    const timelineTimeouts: Array<ReturnType<typeof setTimeout>> = [];
    timelineTimeouts.push(
      setTimeout(
        () => addTimelineEvent('Initializing search agent', `Setting up workspace for ${primaryRole} search in ${locationLabel}.`),
        1000,
      ),
    );
    timelineTimeouts.push(
      setTimeout(() => addTimelineEvent('Extracting keywords from CV', `Target roles: ${roles.join(', ') || primaryRole}.`), 3000),
    );
    timelineTimeouts.push(
      setTimeout(() => addTimelineEvent('Querying Valyu Search API', `Searching: "${searchQuery}".`), 5500),
    );

    const searchTimeout = setTimeout(async () => {
      try {
        const fetched = await searchJobs({
          query: searchQuery,
          countryCode,
          maxNumResults: 12,
        });
        const nextResults = fetched.length ? fetched : FALLBACK_RESULTS;
        setResults(nextResults);
        addTimelineEvent(
          `Found ${nextResults.length} potential matches`,
          'Filtering results by relevance and ranking opportunities.',
        );
        setTimeout(() => {
          addTimelineEvent('Ranking opportunities', 'Calculated fit score based on title and source relevance.');
        }, 2500);
      } catch (error) {
        setResults(FALLBACK_RESULTS);
        addTimelineEvent('Valyu API unavailable', 'Falling back to cached sample opportunities for this session.');
      }
    }, 7000);

    return () => {
      timelineTimeouts.forEach(clearTimeout);
      clearTimeout(searchTimeout);
    };
  }, [status, addTimelineEvent, primaryRole, locationLabel, roles, searchQuery, countryCode]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStop = () => {
    setStatus('completed');
    setTimeout(() => {
      navigate(`/report/${id}`);
    }, 1000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 md:p-6 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-neutral-900" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">{`${primaryRole} ${locationLabel}`}</h1>
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                status === 'running' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}>
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
            {status === 'running' ? (
              <button 
                onClick={() => setStatus('paused')}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-lg font-bold hover:bg-amber-100 transition-all min-h-[44px]"
              >
                <Pause size={18} />
                <span className="md:hidden lg:inline">Pause</span>
              </button>
            ) : (
              <button 
                onClick={() => setStatus('running')}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg font-bold hover:bg-emerald-100 transition-all min-h-[44px]"
              >
                <Play size={18} />
                <span className="md:hidden lg:inline">Resume</span>
              </button>
            )}
            <button 
              onClick={handleStop}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-600 rounded-lg font-bold hover:bg-neutral-200 transition-all min-h-[44px]"
            >
              <Square size={18} />
              <span className="md:hidden lg:inline">Stop</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Left Column - Controls */}
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
                {[
                  { name: 'Valyu Search', status: 'Searching' },
                  { name: 'Web Sources', status: 'Searching' },
                  { name: 'News Index', status: 'Queued' },
                  { name: 'Proprietary', status: 'Queued' },
                ].map((source) => (
                  <div key={source.name} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-600">{source.name}</span>
                    <div className="flex items-center gap-1.5">
                      {source.status === 'Searching' && <Loader2 size={12} className="animate-spin text-neutral-900" />}
                      <span className={`text-[10px] font-bold uppercase ${source.status === 'Searching' ? 'text-neutral-900' : 'text-neutral-400'}`}>
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

        {/* Center Column - Timeline */}
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
                timeline.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative pl-10"
                  >
                    <div className="absolute left-3.5 top-1.5 w-3 h-3 rounded-full bg-white border-2 border-neutral-900 z-10" />
                    <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm hover:border-neutral-400 transition-all group cursor-pointer">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-sm font-bold text-neutral-900">{item.title}</h4>
                        <span className="text-[10px] font-mono text-neutral-400">{item.timestamp}</span>
                      </div>
                      <p className="text-xs text-neutral-500 leading-relaxed">{item.description}</p>
                      <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-neutral-900 opacity-0 group-hover:opacity-100 transition-all">
                        View details <ChevronRight size={10} />
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4">
              {['all', 'shortlisted', 'saved'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`text-sm font-bold capitalize transition-all pb-1 border-b-2 ${
                    activeTab === tab ? 'text-neutral-900 border-neutral-900' : 'text-neutral-400 border-transparent hover:text-neutral-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{results.length} Found</span>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {results.length === 0 ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white border border-neutral-100 rounded-xl p-5 animate-pulse space-y-3">
                      <div className="h-4 bg-neutral-100 rounded w-3/4" />
                      <div className="h-3 bg-neutral-100 rounded w-1/2" />
                      <div className="flex gap-2">
                        <div className="h-5 bg-neutral-100 rounded w-16" />
                        <div className="h-5 bg-neutral-100 rounded w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                results.map((result) => (
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
                        <p className="text-sm text-neutral-500">{result.organization} • {result.location}</p>
                      </div>
                      <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        result.fitScore === 'High' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {result.fitScore} Fit
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {result.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-neutral-50 text-neutral-500 rounded text-[10px] font-medium border border-neutral-100">
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
                            setResults(prev => prev.map(r => r.id === result.id ? { ...r, isSuspicious: !r.isSuspicious } : r));
                          }}
                          className={`p-2 rounded-lg transition-all ${result.isSuspicious ? 'text-red-600 bg-red-50' : 'text-neutral-400 hover:text-red-600 hover:bg-red-50'}`}
                          title="Flag as Suspicious"
                        >
                          <AlertCircle size={16} />
                        </button>
                      </div>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 text-neutral-900 rounded-lg text-xs font-bold hover:bg-neutral-200 transition-all min-h-[40px]">
                        Open Link
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
            
            {status === 'running' && (
              <div className="p-4 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-neutral-900" />
                <p className="text-xs font-medium text-neutral-700">Searching for more opportunities...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
