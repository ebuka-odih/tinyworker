import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  FileText,
  GraduationCap,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'motion/react';

import { useAuth } from '../auth/AuthContext';

const useCases = [
  {
    id: 'job',
    title: 'Job Search',
    description:
      'Search across major job boards and company career pages to find roles that match your skills, experience, and preferred country.',
    icon: Briefcase,
  },
  {
    id: 'scholarship',
    title: 'Scholarship Search',
    description:
      'Discover scholarships, funding programs, and university opportunities that fit your academic goals and destination preferences.',
    icon: GraduationCap,
  },
  {
    id: 'grant',
    title: 'Grant Search',
    description:
      'Find open grant opportunities for founders, nonprofits, researchers, and innovators with direct funding and clear application routes.',
    icon: ShieldCheck,
  },
  {
    id: 'visa',
    title: 'Visa Guidance',
    description:
      'Understand visa requirements, document needs, and relocation pathways using structured flows based on your target country.',
    icon: FileText,
  },
] as const;

const steps = [
  {
    title: 'Choose a search type',
    body: 'Select whether you want to search for jobs, scholarships, grants, or visa requirements.',
  },
  {
    title: 'Add your criteria',
    body: 'Provide your goals, qualifications, destination preferences, or relocation context through a guided flow.',
  },
  {
    title: 'TinyFinder searches the web',
    body: 'We scan relevant public sources and organize results into a cleaner, easier-to-review experience.',
  },
  {
    title: 'Review and continue later',
    body: 'Save searches, revisit results, and refine your criteria without starting from scratch.',
  },
] as const;

const sourceTypes = [
  'Job Boards',
  'Career Pages',
  'University Funding Pages',
  'Scholarship Sources',
  'Grant Programs',
  'Immigration Resources',
] as const;

const benefits = [
  {
    title: 'Less manual searching',
    body: 'Avoid opening dozens of tabs just to compare opportunities.',
  },
  {
    title: 'More structured discovery',
    body: 'Use guided search flows instead of scattered browsing.',
  },
  {
    title: 'Relevant opportunity matching',
    body: 'Search around your goals, profile, destination, and preferences.',
  },
  {
    title: 'Save and continue',
    body: 'Keep searches organized so you can return later without re-entering everything.',
  },
] as const;

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleStart = React.useCallback(() => {
    if (isAuthenticated) {
      navigate('/new-search');
      return;
    }

    navigate('/auth?next=%2Fnew-search');
  }, [isAuthenticated, navigate]);

  const handleSeeHowItWorks = React.useCallback(() => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="space-y-8 py-4 md:space-y-10 md:py-8">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="overflow-hidden rounded-[32px] border border-neutral-200 bg-white shadow-sm"
      >
        <div className="grid gap-10 p-6 md:p-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:p-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">
              <Search size={14} />
              AI-powered opportunity search
            </div>
            <h1 className="mt-5 text-[36px] font-bold tracking-tight text-neutral-950 md:text-[52px] md:leading-[1.02]">
              Find jobs, scholarships, grants, and visa pathways faster.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-neutral-600 md:text-lg">
              TinyFinder searches across job boards, scholarship sources, grant programs, and official visa
              information pages to help you discover relevant opportunities with less manual searching.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleStart}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-black"
              >
                {isAuthenticated ? 'Start Searching' : 'Find Opportunities'}
                <ArrowRight size={18} />
              </button>
              <button
                type="button"
                onClick={handleSeeHowItWorks}
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-neutral-200 bg-white px-6 py-3 text-sm font-bold text-neutral-700 transition-all hover:border-neutral-300 hover:text-neutral-950"
              >
                See How It Works
              </button>
            </div>

            <p className="mt-5 text-sm leading-7 text-neutral-500">
              Search across job platforms, funding pages, grant programs, and official immigration resources.
            </p>
          </div>

          <div className="rounded-[28px] bg-neutral-950 p-6 text-white md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-neutral-400">What TinyFinder searches</p>
            <div className="mt-6 space-y-4">
              {[
                {
                  title: 'Jobs',
                  body: 'Major job boards and company career pages.',
                },
                {
                  title: 'Scholarships',
                  body: 'Scholarship sources, university funding pages, and study opportunities.',
                },
                {
                  title: 'Grants',
                  body: 'Official grant programs and vetted discovery sources that lead to direct application pages.',
                },
                {
                  title: 'Visa pathways',
                  body: 'Official immigration resources and country-specific requirement pages where applicable.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-bold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-300">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-bold text-white">Why it feels faster</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
                <span>Guided setup</span>
                <span className="h-1 w-1 rounded-full bg-neutral-500" />
                <span>Web search</span>
                <span className="h-1 w-1 rounded-full bg-neutral-500" />
                <span>Saved results</span>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="rounded-[32px] border border-neutral-200 bg-white p-6 shadow-sm md:p-8 lg:p-10">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-neutral-400">Use cases</p>
          <h2 className="mt-3 text-[30px] font-bold tracking-tight text-neutral-950 md:text-[38px]">
            What TinyFinder helps you do
          </h2>
          <p className="mt-3 text-sm leading-7 text-neutral-500 md:text-base">
            Start with the opportunity you care about most, then let TinyFinder organize the search around your goals.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {useCases.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
              className="rounded-[28px] border border-neutral-200 bg-neutral-50/70 p-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-neutral-900 shadow-sm">
                <item.icon size={22} />
              </div>
              <h3 className="mt-6 text-2xl font-bold tracking-tight text-neutral-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-neutral-500">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section
        id="how-it-works"
        className="rounded-[32px] border border-neutral-200 bg-white p-6 shadow-sm md:p-8 lg:p-10"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-neutral-400">How it works</p>
          <h2 className="mt-3 text-[30px] font-bold tracking-tight text-neutral-950 md:text-[38px]">
            Search with a guided flow instead of scattered tabs
          </h2>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-[28px] border border-neutral-200 bg-neutral-50/70 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-900 text-sm font-bold text-white">
                {index + 1}
              </div>
              <h3 className="mt-5 text-xl font-bold tracking-tight text-neutral-950">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-neutral-500">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-[32px] border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-700">
            <ShieldCheck size={14} />
            Trust and sources
          </div>
          <h2 className="mt-4 text-[30px] font-bold tracking-tight text-neutral-950 md:text-[38px]">
            Search across trusted public sources
          </h2>
          <p className="mt-4 text-sm leading-7 text-neutral-500 md:text-base">
            TinyFinder helps reduce manual searching by organizing information from job sites, scholarship sources,
            university pages, and official visa information resources into guided search flows.
          </p>
          <p className="mt-4 text-sm leading-7 text-neutral-500">
            It is built to feel more like a focused opportunity search engine than a generic dashboard.
          </p>
        </div>

        <div className="rounded-[32px] border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-neutral-400">Source types</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {sourceTypes.map((item) => (
              <span
                key={item}
                className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-700"
              >
                {item}
              </span>
            ))}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              'Guided criteria before results',
              'Clearer review experience',
              'Searches saved for later',
              'Structured next steps',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4">
                <CheckCircle2 size={18} className="mt-0.5 text-emerald-600" />
                <p className="text-sm font-medium text-neutral-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-neutral-200 bg-white p-6 shadow-sm md:p-8 lg:p-10">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-neutral-400">Benefits</p>
          <h2 className="mt-3 text-[30px] font-bold tracking-tight text-neutral-950 md:text-[38px]">
            Why use TinyFinder instead of searching manually
          </h2>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {benefits.map((item) => (
            <div key={item.title} className="rounded-[28px] border border-neutral-200 bg-neutral-50/70 p-6">
              <h3 className="text-xl font-bold tracking-tight text-neutral-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-neutral-500">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-neutral-900 bg-neutral-950 p-6 text-white shadow-sm md:p-8 lg:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-neutral-500">Start now</p>
            <h2 className="mt-3 text-[30px] font-bold tracking-tight md:text-[40px]">Ready to search smarter?</h2>
            <p className="mt-4 text-sm leading-7 text-neutral-300 md:text-base">
              Start with jobs, scholarships, or visa requirements in one guided workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={handleStart}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-neutral-950 transition-all hover:bg-neutral-100"
          >
            {isAuthenticated ? 'Start Your Search' : 'Create Account and Begin'}
            <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}
