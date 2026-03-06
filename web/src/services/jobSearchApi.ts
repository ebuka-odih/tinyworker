import { SearchResult } from '../types';
import { API_BASE, ApiUnauthorizedError, buildAuthHeaders, readErrorMessage } from './apiBase';

type JobSearchResponse = {
  ok?: boolean;
  results?: SearchResult[];
};

export async function searchJobs(params: {
  token: string;
  query: string;
  countryCode?: string;
  maxNumResults?: number;
  signal?: AbortSignal;
}): Promise<SearchResult[]> {
  const qs = new URLSearchParams();
  qs.set('query', params.query);
  if (params.countryCode) qs.set('countryCode', params.countryCode);
  if (params.maxNumResults) qs.set('maxNumResults', String(params.maxNumResults));

  const res = await fetch(`${API_BASE}/opportunities/search/jobs?${qs.toString()}`, {
    headers: buildAuthHeaders(params.token),
    signal: params.signal,
  });
  if (res.status === 401) {
    throw new ApiUnauthorizedError();
  }
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Job search failed (${res.status})`));
  }

  const json = (await res.json()) as JobSearchResponse;
  return Array.isArray(json.results) ? json.results : [];
}
