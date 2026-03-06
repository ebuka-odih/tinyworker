import { SearchCacheState, SearchResult } from '../types';
import { API_BASE, ApiUnauthorizedError, buildAuthHeaders, readErrorMessage } from './apiBase';

export { ApiUnauthorizedError } from './apiBase';

export type StartSearchRunParams = {
  token: string;
  query: string;
  countryCode?: string;
  maxNumResults?: number;
  sourceScope?: 'global' | 'regional';
  remote?: boolean;
  visaSponsorship?: boolean;
};

export type SearchRunEventType =
  | 'run_started'
  | 'run_cache_hit'
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
    cache?: SearchCacheState;
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
  cache?: SearchCacheState | null;
};

export async function startJobSearchRun(params: StartSearchRunParams): Promise<{ runId: string }> {
  const response = await fetch(`${API_BASE}/opportunities/search/jobs/runs`, {
    method: 'POST',
    headers: buildAuthHeaders(params.token, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      query: params.query,
      countryCode: params.countryCode,
      maxNumResults: params.maxNumResults ?? 10,
      sourceScope: params.sourceScope ?? 'global',
      remote: params.remote ?? false,
      visaSponsorship: params.visaSponsorship ?? false,
    }),
  });

  if (response.status === 401) {
    throw new ApiUnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to start search run (${response.status})`));
  }

  const payload = (await response.json()) as { runId?: string };
  if (!payload.runId) {
    throw new Error('Search run did not return a runId.');
  }

  return { runId: payload.runId };
}

export async function stopJobSearchRun(runId: string, token: string): Promise<void> {
  const response = await fetch(`${API_BASE}/opportunities/search/jobs/runs/${encodeURIComponent(runId)}/stop`, {
    method: 'POST',
    headers: buildAuthHeaders(token),
  });

  if (response.status === 401) {
    throw new ApiUnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to stop search run (${response.status})`));
  }
}

export async function getJobSearchRunSnapshot(runId: string, token: string): Promise<SearchRunSnapshot | null> {
  const response = await fetch(`${API_BASE}/opportunities/search/jobs/runs/${encodeURIComponent(runId)}`, {
    headers: buildAuthHeaders(token),
  });

  if (response.status === 401) {
    throw new ApiUnauthorizedError();
  }

  if (response.status === 404 || response.status === 400) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to fetch search snapshot (${response.status})`));
  }

  const payload = (await response.json()) as { snapshot?: SearchRunSnapshot };
  return payload.snapshot || null;
}

type StreamParams = {
  runId: string;
  token: string;
  since?: number;
  onEvent: (event: SearchRunEvent) => void;
  onSnapshot?: (snapshot: SearchRunSnapshot) => void;
  onError?: (error: unknown) => void;
};

export function connectJobSearchRunStream(params: StreamParams): { close: () => void } {
  let closed = false;
  let currentSince = typeof params.since === 'number' && Number.isFinite(params.since) ? params.since : 0;
  let activeController: AbortController | null = null;

  const readStream = async () => {
    while (!closed) {
      const controller = new AbortController();
      activeController = controller;

      try {
        const streamUrl = new URL(
          `${API_BASE}/opportunities/search/jobs/runs/${encodeURIComponent(params.runId)}/stream`,
          window.location.origin,
        );
        if (currentSince > 0) {
          streamUrl.searchParams.set('since', String(currentSince));
        }

        const response = await fetch(streamUrl.toString(), {
          headers: buildAuthHeaders(params.token, {
            Accept: 'text/event-stream',
          }),
          signal: controller.signal,
        });

        if (response.status === 401) {
          throw new ApiUnauthorizedError();
        }

        if (!response.ok) {
          throw new Error(await readErrorMessage(response, `Search stream failed (${response.status})`));
        }

        if (!response.body) {
          throw new Error('Search stream returned no body.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!closed) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');

          while (true) {
            const separatorIndex = buffer.indexOf('\n\n');
            if (separatorIndex === -1) break;

            const rawEvent = buffer.slice(0, separatorIndex);
            buffer = buffer.slice(separatorIndex + 2);

            const lines = rawEvent.split('\n');
            const dataLines: string[] = [];
            let eventName = '';

            for (const line of lines) {
              if (line.startsWith(':')) continue;
              if (line.startsWith('event:')) {
                eventName = line.slice('event:'.length).trim();
                continue;
              }
              if (line.startsWith('data:')) {
                dataLines.push(line.slice('data:'.length).trim());
              }
            }

            if (!dataLines.length) continue;
            const payload = dataLines.join('\n').trim();
            if (!payload) continue;

            try {
              if (eventName === 'snapshot') {
                const snapshot = JSON.parse(payload) as SearchRunSnapshot;
                currentSince = Math.max(currentSince, Number(snapshot.lastSequence || 0));
                params.onSnapshot?.(snapshot);
                continue;
              }

              const event = JSON.parse(payload) as SearchRunEvent;
              currentSince = Math.max(currentSince, Number(event.sequence || 0));
              params.onEvent(event);
            } catch {
              // Ignore malformed stream payloads.
            }
          }
        }

        if (closed) return;
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      } catch (error) {
        activeController = null;
        if (closed || controller.signal.aborted) return;
        params.onError?.(error);
        if (error instanceof ApiUnauthorizedError) return;
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }
    }
  };

  void readStream();

  return {
    close: () => {
      closed = true;
      activeController?.abort();
      activeController = null;
    },
  };
}
