const DEFAULT_PRODUCTION_API_BASE = 'https://tinyworker-production.up.railway.app/api';

export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:4000/api' : DEFAULT_PRODUCTION_API_BASE)
).replace(/\/$/, '');

export class ApiUnauthorizedError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'ApiUnauthorizedError';
  }
}

export class ApiPaymentRequiredError<T = unknown> extends Error {
  payload: T | null;

  constructor(message = 'Payment required', payload: T | null = null) {
    super(message);
    this.name = 'ApiPaymentRequiredError';
    this.payload = payload;
  }
}

export function buildAuthHeaders(token: string, headers?: HeadersInit): Headers {
  const next = new Headers(headers || {});
  if (token) {
    next.set('Authorization', `Bearer ${token}`);
  }
  return next;
}

type ParsedResponseBody = {
  message: string;
  payload: Record<string, unknown> | null;
};

async function parseResponseBody(response: Response, fallback: string): Promise<ParsedResponseBody> {
  const raw = await response.text().catch(() => '');
  if (!raw) {
    return { message: fallback, payload: null };
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> & { error?: string; message?: string };
    return {
      message: String(parsed.error || parsed.message || raw || fallback),
      payload: parsed,
    };
  } catch {
    return {
      message: raw || fallback,
      payload: null,
    };
  }
}

export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const parsed = await parseResponseBody(response, fallback);
  return parsed.message;
}

export async function readErrorDetails(response: Response, fallback: string): Promise<ParsedResponseBody> {
  return await parseResponseBody(response, fallback);
}
