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
    if (!csrf.ok) throw new Error('Unable to establish a secure session.');
    const data: { csrfToken: string } = await csrf.json();
    headers.set('X-CSRFToken', data.csrfToken);
  }
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  return fetch(`${base}${path}`, { ...options, headers, credentials: 'include', cache: 'no-store' });
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options);
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(typeof data?.detail === 'string' ? data.detail : 'The request could not be completed.', response.status);
  }
  return data as T;
}
