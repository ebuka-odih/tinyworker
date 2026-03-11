import { SavedOpportunity, SearchResult } from '../types';
import { API_BASE, ApiUnauthorizedError, buildAuthHeaders, readErrorMessage } from './apiBase';

function mapSavedOpportunity(raw: any): SavedOpportunity {
  const type = raw?.type === 'scholarship' || raw?.type === 'grant' || raw?.type === 'visa' ? raw.type : 'job';
  return {
    id: String(raw?.id || ''),
    type,
    title: String(raw?.title || 'Untitled role'),
    organization: raw?.organization ? String(raw.organization) : null,
    location: raw?.location ? String(raw.location) : null,
    description: raw?.description ? String(raw.description) : null,
    requirements: Array.isArray(raw?.requirements) ? raw.requirements.filter((item: unknown) => typeof item === 'string') : [],
    link: raw?.link ? String(raw.link) : null,
    deadline: raw?.deadline ? String(raw.deadline) : null,
    matchScore: typeof raw?.matchScore === 'number' ? raw.matchScore : null,
    source: raw?.source ? String(raw.source) : null,
    metadata: raw?.metadata && typeof raw.metadata === 'object' ? (raw.metadata as Record<string, unknown>) : null,
    createdAt: raw?.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw?.updatedAt ? String(raw.updatedAt) : undefined,
  };
}

export async function listSavedOpportunities(token: string, type: SavedOpportunity['type'] = 'job'): Promise<SavedOpportunity[]> {
  const response = await fetch(`${API_BASE}/opportunities?type=${encodeURIComponent(type)}`, {
    headers: buildAuthHeaders(token),
  });

  if (response.status === 401) {
    throw new ApiUnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to load saved opportunities (${response.status})`));
  }

  const payload = (await response.json()) as { opportunities?: unknown[] };
  return Array.isArray(payload.opportunities) ? payload.opportunities.map(mapSavedOpportunity) : [];
}

export async function saveOpportunity(
  token: string,
  result: SearchResult,
  type: SavedOpportunity['type'] = 'job',
): Promise<SavedOpportunity> {
  const metadata = {
    ...(result.metadata || {}),
    ...(result.fundingAmount ? { fundingAmount: result.fundingAmount } : {}),
    ...(result.whoCanApply ? { whoCanApply: result.whoCanApply } : {}),
    ...(result.locationEligibility ? { locationEligibility: result.locationEligibility } : {}),
    ...(result.officialApplicationLink ? { officialApplicationLink: result.officialApplicationLink } : {}),
    ...(result.processingTime ? { processingTime: result.processingTime } : {}),
  };

  const response = await fetch(`${API_BASE}/opportunities/import`, {
    method: 'POST',
    headers: buildAuthHeaders(token, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      items: [
        {
          type,
          title: result.title,
          organization: result.organization || null,
          location: result.location || null,
          description: result.snippet || result.matchReason || null,
          requirements: result.requirements || [],
          link: result.link || null,
          deadline: result.deadline || null,
          matchScore:
            result.fitScore === 'High' ? 0.9 : result.fitScore === 'Medium' ? 0.7 : result.fitScore === 'Low' ? 0.5 : null,
          source: result.sourceName || 'tinyfinder-web',
          ...(Object.keys(metadata).length ? { metadata } : {}),
        },
      ],
    }),
  });

  if (response.status === 401) {
    throw new ApiUnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to save opportunity (${response.status})`));
  }

  const payload = (await response.json()) as { opportunities?: unknown[] };
  const first = Array.isArray(payload.opportunities) ? payload.opportunities[0] : null;
  if (!first) {
    throw new Error('Save request succeeded but no opportunity was returned.');
  }

  return mapSavedOpportunity(first);
}

export async function saveJobOpportunity(token: string, result: SearchResult): Promise<SavedOpportunity> {
  return await saveOpportunity(token, result, 'job');
}
