import type { Page } from 'playwright';

export interface ApiResult<T = unknown> {
  status: number;
  /** Parsed JSON, or the raw text when the response is not JSON (empty string for 204). */
  body: T;
}

interface Credentials {
  token?: string;
  branchId?: string;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** What the web app itself last sent: the access token lives in its memory only, so it is read off its requests. */
const seen = new WeakMap<Page, Credentials>();

function watch(page: Page): Credentials {
  const known = seen.get(page);
  if (known) return known;
  const recorded: Credentials = {};
  seen.set(page, recorded);
  page.on('request', (request) => {
    if (!request.url().includes('/api/')) return;
    const headers = request.headers();
    const authorization = headers.authorization;
    if (authorization?.startsWith('Bearer ')) recorded.token = authorization.slice('Bearer '.length);
    if (headers['x-branch-id']) recorded.branchId = headers['x-branch-id'];
  });
  return recorded;
}

function send(page: Page, method: string, url: string, headers: Record<string, string>, json: unknown): Promise<ApiResult> {
  return page.evaluate(
    async (request) => {
      const requestHeaders = { ...request.headers };
      if (request.json !== undefined) requestHeaders['Content-Type'] = 'application/json';
      const response = await fetch(request.url, {
        method: request.method,
        headers: requestHeaders,
        body: request.json === undefined ? undefined : JSON.stringify(request.json),
      });
      const text = await response.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        // Not JSON (health probe, empty 204): keep the text.
      }
      return { status: response.status, body };
    },
    { method, url, headers, json },
  );
}

/** A new access token through the httpOnly refresh cookie (the same call the web app makes after a reload). */
async function refreshToken(page: Page, credentials: Credentials): Promise<void> {
  const refreshed = await send(page, 'POST', '/api/v1/auth/refresh', {}, undefined);
  const token = (refreshed.body as { accessToken?: string } | null)?.accessToken;
  if (refreshed.status === 200 && token) credentials.token = token;
}

/**
 * A request executed inside the page, through the desktop gateway, as the signed-in user.
 * `path` is root-relative: `/api/v1/orders`, `/health/ready`. The access token and `X-Branch-Id` are the ones the
 * web app last used (pass `headers` to override); without a captured token, or on 401, the refresh cookie is used.
 */
export async function api<T = unknown>(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<ApiResult<T>> {
  const credentials = watch(page);
  const build = (): Record<string, string> => ({
    ...(credentials.token ? { Authorization: `Bearer ${credentials.token}` } : {}),
    ...(credentials.branchId ? { 'X-Branch-Id': credentials.branchId } : {}),
    ...headers,
  });
  if (!credentials.token && path.startsWith('/api/') && !path.includes('/auth/')) await refreshToken(page, credentials);
  let result = await send(page, method, path, build(), body);
  if (result.status === 401 && !path.includes('/auth/')) {
    await refreshToken(page, credentials);
    result = await send(page, method, path, build(), body);
  }
  return result as ApiResult<T>;
}

/** Starts recording the page's access token / branch for `api()`. `startApp` pages do not need it; call it for extra windows before signing in. */
export function trackSession(page: Page): void {
  watch(page);
}

/** Polls until `check` returns a truthy value and resolves with it; throws with `label` after the timeout. */
export async function waitFor<T>(label: string, check: () => Promise<T> | T, timeoutMs = 30_000, intervalMs = 250): Promise<NonNullable<T>> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  for (;;) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    if (Date.now() > deadline) throw new Error(`Timed out after ${timeoutMs} ms waiting for ${label}`, { cause: lastError });
    await delay(intervalMs);
  }
}

/** Polls a GET endpoint until `accept` likes the answer (e.g. an order reaching a status) and resolves with it. */
export function waitForApi<T = unknown>(
  page: Page,
  path: string,
  accept: (result: ApiResult<T>) => boolean,
  timeoutMs = 30_000,
): Promise<ApiResult<T>> {
  return waitFor(`GET ${path}`, async () => {
    const result = await api<T>(page, 'GET', path);
    return accept(result) ? result : null;
  }, timeoutMs, 500);
}
