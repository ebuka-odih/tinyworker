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

  const hasFullDetails = Boolean(
    job.matchReason ||
      job.salary ||
      job.employmentType ||
      job.workMode ||
      job.postedDate ||
      job.requirements?.length ||
      job.responsibilities?.length ||
      job.benefits?.length,
  );
  const sourceLink = job.link && job.link !== '#' ? job.link : null;
  const canOpenSource = Boolean(sourceLink);
  const isReady = job.queueStatus === 'ready' || job.queueStatus === 'verified';

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-white rounded-2xl border border-neutral-200 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
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
          {!isReady && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <h4 className="text-sm font-bold text-amber-900">Details still loading</h4>
              <p className="mt-1 text-sm text-amber-800 leading-relaxed">
                {job.queueStatus === 'failed'
                  ? 'Full extraction did not complete for this job. You can still review the source listing and any partial details below.'
                  : 'This job is still being processed. Available source details are shown now, and richer extracted fields will appear once the run finishes.'}
              </p>
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Detail label="Fit" value={`${job.fitScore} Fit`} />
            <Detail label="Queue Status" value={queueLabel(job.queueStatus)} />
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

          {!job.snippet && !hasFullDetails && (
            <section className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <h4 className="text-sm font-bold text-neutral-900">Limited details available</h4>
              <p className="mt-1 text-sm text-neutral-600 leading-relaxed">
                This card currently has source metadata only. Use the source listing button below to inspect the original posting.
              </p>
            </section>
          )}

          <ListBlock title="Requirements" items={job.requirements} emptyLabel="Requirements are not available for this job yet." />
          <ListBlock
            title="Responsibilities"
            items={job.responsibilities}
            emptyLabel="Responsibilities are not available for this job yet."
          />
          <ListBlock title="Benefits" items={job.benefits} emptyLabel="Benefits are not available for this job yet." />
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-neutral-100 p-4 flex justify-end">
          {canOpenSource ? (
            <a
              href={sourceLink || '#'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-bold hover:bg-black transition-all shadow-sm"
            >
              Open Source Listing
              <ExternalLink size={14} />
            </a>
          ) : (
            <span className="inline-flex min-h-[44px] items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-200 text-neutral-500 text-sm font-bold cursor-not-allowed">
              Source link unavailable
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function queueLabel(status: SearchResult['queueStatus']) {
  if (status === 'queued') return 'Queued';
  if (status === 'extracting') return 'Extracting';
  if (status === 'verified') return 'Verified';
  if (status === 'ready') return 'Ready';
  return 'Failed';
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">{label}</p>
      <p className="text-sm text-neutral-800 mt-1">{value}</p>
    </div>
  );
}

function ListBlock({ title, items, emptyLabel }: { title: string; items?: string[]; emptyLabel: string }) {
  if (!items?.length) {
    return (
      <section>
        <h4 className="text-sm font-bold text-neutral-900 mb-2">{title}</h4>
        <p className="text-sm text-neutral-500 leading-relaxed">{emptyLabel}</p>
      </section>
    );
  }
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
