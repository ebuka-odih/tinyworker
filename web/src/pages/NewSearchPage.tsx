import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, Clock3, FileText, GraduationCap, HandCoins, Layers3, Search } from 'lucide-react';
import { motion } from 'motion/react';

import { useAuth } from '../auth/AuthContext';
import { listRecentSearchSummaries, RecentSearchSummary } from '../services/searchSessionStore';
import { SearchType } from '../types';

type HubTab = 'new' | 'recent';

const searchTypeCards = [
  {
    type: SearchType.JOB,
    title: 'Jobs',
    description:
      'Build a job search profile with your role focus, location, work mode, and visa preferences before running a live search.',
    meta: 'Guided setup • Estimated time: 2–5 min',
    badge: 'Live results',
    cta: 'Start job search',
    icon: Briefcase,
  },
  {
    type: SearchType.SCHOLARSHIP,
    title: 'Scholarships',
    description:
      'Build a scholarship search profile around your study goals, destination preferences, and funding priorities so the setup is ready to refine and save.',
    meta: 'Guided setup • Estimated time: 3–6 min',
    badge: 'Structured flow',
    cta: 'Start scholarship search',
    icon: GraduationCap,
  },
  {
    type: SearchType.GRANT,
    title: 'Grants',
    description:
      'Build a grant search profile around your funding goals, applicant type, focus area, and eligible regions before running a live search.',
    meta: 'Guided setup • Estimated time: 3–6 min',
    badge: 'Live results',
    cta: 'Start grant search',
    icon: HandCoins,
  },
  {
    type: SearchType.VISA,
    title: 'Visa Requirements',
    description:
      'Build a visa guidance profile with your target country, visa path, and relocation context before running a live official-source search.',
    meta: 'Guided setup • Estimated time: 2–4 min',
    badge: 'Live results',
    cta: 'Check visa path',
    icon: FileText,
  },
] as const;

function formatRelativeTime(updatedAt: number): string {
  if (!updatedAt) return 'unknown time';
  const ageMs = Math.max(0, Date.now() - updatedAt);
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getSearchTypeLabel(type: SearchType): string {
  if (type === SearchType.SCHOLARSHIP) return 'Scholarship';
  if (type === SearchType.GRANT) return 'Grant';
  if (type === SearchType.VISA) return 'Visa';
  return 'Job';
}

function getRecentSearchTitle(recent: RecentSearchSummary): string {
  if (recent.type === SearchType.SCHOLARSHIP) {
    return recent.formData.scholarshipQuery || 'Scholarship search';
  }
  if (recent.type === SearchType.GRANT) {
    return recent.formData.grantQuery || 'Grant search';
  }
  if (recent.type === SearchType.VISA) {
    return recent.formData.visaCountry ? `${recent.formData.visaCountry} visa requirements` : 'Visa requirement search';
  }
  return recent.formData.roles?.join(', ') || 'Untitled search';
}

function getRecentSearchSubtitle(recent: RecentSearchSummary): string {
  if (recent.type === SearchType.SCHOLARSHIP) {
    return [recent.formData.destinationRegion, recent.formData.studyLevel, recent.formData.fundingType]
      .filter(Boolean)
      .join(' • ') || 'Scholarship criteria';
  }
  if (recent.type === SearchType.GRANT) {
    return [recent.formData.grantApplicantType, recent.formData.grantFocusArea, recent.formData.grantLocationEligibility]
      .filter(Boolean)
      .join(' • ') || 'Grant criteria';
  }
  if (recent.type === SearchType.VISA) {
    return [recent.formData.visaCategory, recent.formData.nationality, recent.formData.currentResidence]
      .filter(Boolean)
      .join(' • ') || 'Visa criteria';
  }
  return [
    recent.formData.location || 'Any location',
    recent.formData.remote ? 'Remote' : '',
    recent.formData.visaSponsorship ? 'Sponsorship required' : '',
  ]
    .filter(Boolean)
    .join(' • ');
}

function renderRecentActionLabel(recent: RecentSearchSummary): string {
  return recent.type === SearchType.SCHOLARSHIP ? 'Continue setup' : 'Open results';
}

export function NewSearchPage() {
  const navigate = useNavigate();
  const { authUser } = useAuth();
  const authUserId = String(authUser?.userId || '').trim();
  const [activeTab, setActiveTab] = React.useState<HubTab>('new');
  const recentSearches = React.useMemo(() => listRecentSearchSummaries(authUserId), [authUserId]);

  const openRecent = React.useCallback(
    (recent: RecentSearchSummary) => {
      if (recent.type !== SearchType.SCHOLARSHIP) {
        navigate(`/session/${recent.sessionId}`);
        return;
      }

      navigate(`/intake/${recent.type}`, {
        state: {
          prefill: recent.formData,
          reusedFromSessionId: recent.sessionId,
          resumeAtReview: true,
        },
      });
    },
    [navigate],
  );

  const useRecentAsBase = React.useCallback(
    (recent: RecentSearchSummary) => {
      navigate(`/intake/${recent.type}`, {
        state: {
          prefill: recent.formData,
          reusedFromSessionId: recent.sessionId,
        },
      });
    },
    [navigate],
  );

  return (
    <div className="space-y-8 py-4 md:py-8">
      <div className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">
              <Layers3 size={14} />
              AI-powered search workspace
            </div>
            <h1 className="mt-4 text-[30px] font-bold tracking-tight text-neutral-950 md:text-[40px]">
              Choose what you want to search for
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-500 md:text-base">
              TinyFinder helps you search jobs, scholarships, grants, and visa requirements through guided flows that organize
              your criteria before scanning relevant public sources.
            </p>
            <p className="mt-4 text-sm leading-7 text-neutral-500">
              Select a search flow to help TinyFinder understand your goals before gathering results.
            </p>
          </div>

          <div className="inline-flex w-full rounded-2xl bg-neutral-100 p-1 md:w-auto">
            {[
              { id: 'new' as const, label: 'Search Flows' },
              { id: 'recent' as const, label: 'Recent Searches' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[44px] flex-1 rounded-[14px] px-4 py-2 text-sm font-bold transition-all md:flex-none ${
                  activeTab === tab.id ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'new' ? (
        <>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 shadow-sm">
            Jobs, scholarships, grants, and visa requirements can all run live now.
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {searchTypeCards.map((card, index) => (
              <motion.button
                key={card.type}
                type="button"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: index * 0.05 }}
                onClick={() => navigate(`/intake/${card.type}`)}
                className="group rounded-[28px] border border-neutral-200 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-900">
                    <card.icon size={22} />
                  </div>
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
                    {card.badge}
                  </span>
                </div>

                <h2 className="mt-6 text-2xl font-bold tracking-tight text-neutral-950">{card.title}</h2>
                <p className="mt-3 text-sm leading-7 text-neutral-500">{card.description}</p>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-neutral-50 px-3 py-1 text-[11px] font-bold text-neutral-500">
                  <Clock3 size={14} />
                  {card.meta}
                </div>

                <div className="mt-8 flex items-center justify-between border-t border-neutral-100 pt-5 text-sm font-bold text-neutral-900">
                  <span className="text-neutral-500">Guided flow</span>
                  <span className="inline-flex items-center gap-2">
                    {card.cta}
                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-[32px] border border-neutral-100 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Saved search setups and results</h2>
              <p className="text-sm text-neutral-500">
                Reopen live job, grant, and visa results or reuse saved scholarship criteria without starting from scratch.
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{recentSearches.length} saved</span>
          </div>

          {recentSearches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/70 px-6 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-neutral-500 shadow-sm">
                <Search size={22} />
              </div>
              <h3 className="mt-4 text-lg font-bold text-neutral-900">No recent searches yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-neutral-500">
                Start a job, scholarship, grant, or visa search flow. Once you complete a setup or run, it will appear here
                for quick reuse.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('new')}
                className="mt-5 min-h-[44px] rounded-xl bg-neutral-900 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-black"
              >
                Start Search Setup
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {recentSearches.map((recent) => (
                <div key={recent.sessionId} className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 md:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">
                          {getSearchTypeLabel(recent.type)}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400">{recent.status}</span>
                      </div>
                      <h3 className="mt-3 text-xl font-bold leading-tight text-neutral-950">{getRecentSearchTitle(recent)}</h3>
                      <p className="mt-2 text-sm leading-6 text-neutral-500">{getRecentSearchSubtitle(recent)}</p>
                    </div>
                    <span className="text-xs font-medium text-neutral-400">Updated {formatRelativeTime(recent.updatedAt)}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <span className="rounded-lg bg-emerald-50 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                      {recent.counts.ready} ready
                    </span>
                    <span className="rounded-lg bg-neutral-100 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-neutral-700">
                      {recent.counts.queued} queued
                    </span>
                    <span className="rounded-lg bg-red-50 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-red-700">
                      {recent.counts.failed} failed
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => openRecent(recent)}
                      className="min-h-[44px] rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-700 transition-all hover:text-neutral-950"
                    >
                      {renderRecentActionLabel(recent)}
                    </button>
                    <button
                      type="button"
                      onClick={() => useRecentAsBase(recent)}
                      className="min-h-[44px] rounded-xl bg-neutral-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-black"
                    >
                      Use as base
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
