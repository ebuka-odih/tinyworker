import { SearchResult } from '../types';

type JobSearchResponse = {
  ok?: boolean;
  results?: SearchResult[];
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export async function searchJobs(params: {
  query: string;
  countryCode?: string;
  maxNumResults?: number;
}): Promise<SearchResult[]> {
  const qs = new URLSearchParams();
  qs.set('query', params.query);
  if (params.countryCode) qs.set('countryCode', params.countryCode);
  if (params.maxNumResults) qs.set('maxNumResults', String(params.maxNumResults));

  const res = await fetch(`${API_BASE}/opportunities/search/jobs?${qs.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Job search failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as JobSearchResponse;
  return Array.isArray(json.results) ? json.results : [];
}
