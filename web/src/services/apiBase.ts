export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:4000/api' : '/api')
).replace(/\/$/, '');

export class ApiUnauthorizedError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'ApiUnauthorizedError';
  }
}

export function buildAuthHeaders(token: string, headers?: HeadersInit): Headers {
  const next = new Headers(headers || {});
  if (token) {
    next.set('Authorization', `Bearer ${token}`);
  }
  return next;
}

export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const raw = await response.text().catch(() => '');
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as { error?: string; message?: string };
    return parsed.error || parsed.message || raw || fallback;
  } catch {
    return raw || fallback;
  }
}
