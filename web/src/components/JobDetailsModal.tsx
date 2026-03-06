import React from 'react';
import { X, ExternalLink, CheckCircle2 } from 'lucide-react';
import { SearchResult } from '../types';

type JobDetailsModalProps = {
  job: SearchResult | null;
  onClose: () => void;
};

export function JobDetailsModal({ job, onClose }: JobDetailsModalProps) {
  React.useEffect(() => {
    if (!job) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [job, onClose]);

  if (!job) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-white rounded-2xl border border-neutral-200 shadow-2xl max-h-[90vh] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-neutral-100">
          <div>
            <h3 className="text-xl font-bold text-neutral-900">{job.title}</h3>
            <p className="text-sm text-neutral-500 mt-1">
              {job.organization} • {job.location}
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500">
              <span className="px-2 py-0.5 rounded bg-neutral-100 border border-neutral-200">{job.sourceName}</span>
              <span>{job.sourceDomain}</span>
              {job.sourceVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <CheckCircle2 size={12} />
                  Verified source
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-all"
            aria-label="Close details modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(90vh-160px)] space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Detail label="Fit" value={`${job.fitScore} Fit`} />
            <Detail label="Queue Status" value={job.queueStatus} />
            <Detail label="Salary" value={job.salary || 'Not stated'} />
            <Detail label="Employment" value={job.employmentType || 'Not stated'} />
            <Detail label="Work Mode" value={job.workMode || 'Not stated'} />
            <Detail label="Posted" value={job.postedDate || 'Not stated'} />
          </div>

          {job.matchReason && (
            <section>
              <h4 className="text-sm font-bold text-neutral-900 mb-2">Why this match</h4>
              <p className="text-sm text-neutral-700 leading-relaxed">{job.matchReason}</p>
            </section>
          )}

          {job.snippet && (
            <section>
              <h4 className="text-sm font-bold text-neutral-900 mb-2">Summary</h4>
              <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">{job.snippet}</p>
            </section>
          )}

          <ListBlock title="Requirements" items={job.requirements} />
          <ListBlock title="Responsibilities" items={job.responsibilities} />
          <ListBlock title="Benefits" items={job.benefits} />
        </div>

        <div className="p-4 border-t border-neutral-100 flex justify-end">
          <a
            href={job.link || '#'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-bold hover:bg-black transition-all"
          >
            Open Source Listing
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">{label}</p>
      <p className="text-sm text-neutral-800 mt-1">{value}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <section>
      <h4 className="text-sm font-bold text-neutral-900 mb-2">{title}</h4>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="text-sm text-neutral-700 leading-relaxed">
            • {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
