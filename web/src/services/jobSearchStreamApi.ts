import { SearchResult } from '../types';

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:4000/api' : '/api')
).replace(/\/$/, '');

export type StartSearchRunParams = {
  query: string;
  countryCode?: string;
  maxNumResults?: number;
  sourceScope?: 'global' | 'regional';
  remote?: boolean;
  visaSponsorship?: boolean;
};

export type SearchRunEventType =
  | 'run_started'
  | 'source_scan_started'
  | 'candidate_queued'
  | 'candidate_extracting'
  | 'candidate_ready'
  | 'candidate_failed'
  | 'run_progress'
  | 'run_completed'
  | 'run_stopped'
  | 'run_error';

export type SearchRunEvent = {
  id?: string;
  runId: string;
  sequence: number;
  type: SearchRunEventType;
  payload?: {
    result?: SearchResult;
    message?: string;
    [key: string]: unknown;
  };
  createdAt?: string;
};

export type SearchRunSnapshot = {
  runId: string;
  status: string;
  counts?: {
    queued?: number;
    ready?: number;
    failed?: number;
  };
  results?: SearchResult[];
  events?: SearchRunEvent[];
  lastSequence?: number;
};

export async function startJobSearchRun(params: StartSearchRunParams): Promise<{ runId: string }> {
  const res = await fetch(`${API_BASE}/opportunities/search/jobs/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: params.query,
      countryCode: params.countryCode,
      maxNumResults: params.maxNumResults ?? 12,
      sourceScope: params.sourceScope ?? 'global',
      remote: params.remote ?? false,
      visaSponsorship: params.visaSponsorship ?? false,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to start search run (${res.status}): ${body}`);
  }
  const json = (await res.json()) as { ok?: boolean; runId?: string };
  if (!json.runId) throw new Error('Search run did not return a runId.');
  return { runId: json.runId };
}

export async function stopJobSearchRun(runId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/opportunities/search/jobs/runs/${encodeURIComponent(runId)}/stop`, {
    method: 'POST',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to stop search run (${res.status}): ${body}`);
  }
}

export async function getJobSearchRunSnapshot(runId: string): Promise<SearchRunSnapshot | null> {
  const res = await fetch(`${API_BASE}/opportunities/search/jobs/runs/${encodeURIComponent(runId)}`);
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch search snapshot (${res.status}): ${body}`);
  }
  const json = (await res.json()) as { ok?: boolean; snapshot?: SearchRunSnapshot };
  return json.snapshot || null;
}

export function connectJobSearchRunStream(params: {
  runId: string;
  since?: number;
  onEvent: (event: SearchRunEvent) => void;
  onSnapshot?: (snapshot: SearchRunSnapshot) => void;
  onError?: (error: Event) => void;
}): { close: () => void } {
  const streamUrl = new URL(`${API_BASE}/opportunities/search/jobs/runs/${encodeURIComponent(params.runId)}/stream`, window.location.origin);
  if (typeof params.since === 'number' && Number.isFinite(params.since) && params.since > 0) {
    streamUrl.searchParams.set('since', String(params.since));
  }

  const source = new EventSource(streamUrl.toString());
  const eventNames: SearchRunEventType[] = [
    'run_started',
    'source_scan_started',
    'candidate_queued',
    'candidate_extracting',
    'candidate_ready',
    'candidate_failed',
    'run_progress',
    'run_completed',
    'run_stopped',
    'run_error',
  ];

  for (const eventName of eventNames) {
    source.addEventListener(eventName, (evt) => {
      const payload = (evt as MessageEvent<string>).data;
      if (!payload) return;
      try {
        const parsed = JSON.parse(payload) as SearchRunEvent;
        params.onEvent(parsed);
      } catch {
        // Ignore malformed payloads from the stream.
      }
    });
  }

  source.addEventListener('snapshot', (evt) => {
    const payload = (evt as MessageEvent<string>).data;
    if (!payload || !params.onSnapshot) return;
    try {
      params.onSnapshot(JSON.parse(payload) as SearchRunSnapshot);
    } catch {
      // Ignore malformed snapshots.
    }
  });

  source.onerror = (error) => {
    params.onError?.(error);
  };

  return {
    close: () => source.close(),
  };
}
