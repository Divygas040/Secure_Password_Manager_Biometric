// Session cookie is HttpOnly. Only the masked CSRF token is available to JS.
function apiBase(): string {
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (!value) throw new Error('API URL is not configured.');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('API URL must be an HTTP(S) origin.');
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('Production API requires HTTPS.');
  }
  return url.origin;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!path.startsWith('/api/') || path.includes('://')) throw new Error('Invalid API path.');
  const base = apiBase();
  const headers = new Headers(options.headers);
  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Fetch per mutation so login/logout in another tab cannot leave a stale token.
    const csrf = await fetch(`${base}/api/users/csrf/`, { credentials: 'include', cache: 'no-store' });
    if (!csrf.ok) {
      const result = formatApiError(await csrf.json().catch(() => null), csrf.status, csrf.headers.get('Retry-After'));
      throw new ApiError(result.message, csrf.status, result.fields, result.retryAfter, result.hasFormMessage);
    }
    const data: { csrfToken: string } = await csrf.json();
    headers.set('X-CSRFToken', data.csrfToken);
  }
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  return fetch(`${base}${path}`, { ...options, headers, credentials: 'include', cache: 'no-store' });
}

export type FieldErrors = Record<string, string>;

// Only bounded text messages are rendered by React, never server HTML or debug pages.
function messages(value: unknown): string[] {
  if (Array.isArray(value)) return value.slice(0, 8).flatMap(messages);
  if (typeof value !== 'string' || value.length > 500 || /<[^>]*>|Traceback|stack trace|File \"|\bat \S+.*:\d+:\d+/i.test(value)) return [];
  return [value];
}
export function formatApiError(data: unknown, status: number, retryAfter: string | null = null) {
  const fields: FieldErrors = {};
  const record = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {};
  let detail = '';
  if (status < 500) {
    detail = messages(record.detail ?? record.non_field_errors ?? (Array.isArray(data) ? data : null)).join(' ');
    for (const [key, value] of Object.entries(record)) {
      if (!/^[a-z][a-z0-9_]*$/.test(key) || ['detail', 'non_field_errors', 'retry_after', '__proto__', 'constructor', 'prototype'].includes(key)) continue;
      const text = messages(value).join(' ');
      if (text) fields[key] = text;
    }
  }
  let wait: number | undefined;
  if (status === 429) {
    const raw = retryAfter ?? record.retry_after;
    if (typeof raw === 'number' || typeof raw === 'string') {
      const seconds = Number(raw);
      const parsed = Number.isFinite(seconds) ? seconds : (Date.parse(String(raw)) - Date.now()) / 1000;
      if (Number.isFinite(parsed) && parsed >= 0) wait = Math.ceil(parsed);
    }
    detail ||= 'Too many requests.';
    if (wait !== undefined) detail += ` Try again in ${wait} seconds.`;
  }
  const message = detail || (status === 503 ? 'Service temporarily unavailable. Please try again later.' : 'The request could not be completed.');
  return { message, fields, retryAfter: wait, hasFormMessage: Boolean(detail) || !Object.keys(fields).length };
}

export class ApiError extends Error {
  status: number;
  fields: FieldErrors;
  retryAfter?: number;
  hasFormMessage: boolean;
  constructor(message: string, status: number, fields: FieldErrors = {}, retryAfter?: number, hasFormMessage = true) {
    super(message); this.status = status; this.fields = fields; this.retryAfter = retryAfter; this.hasFormMessage = hasFormMessage;
  }
}
export function formError(error: unknown, allowedFields: string[]) {
  if (!(error instanceof ApiError)) return { fields: {}, message: 'Unable to connect. Please try again.' };
  const fields = Object.fromEntries(Object.entries(error.fields).filter(([key]) => allowedFields.includes(key)));
  return { fields, message: error.hasFormMessage || !Object.keys(fields).length ? error.message : '' };
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options);
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const result = formatApiError(data, response.status, response.headers.get('Retry-After'));
    throw new ApiError(result.message, response.status, result.fields, result.retryAfter, result.hasFormMessage);
  }
  return data as T;
}
