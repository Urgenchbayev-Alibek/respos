import { env } from '@/shared/config/env';
import type { AuthResponse } from '@/shared/types/api-response';
import { apiErrorFromProblem, isApiError, networkError } from './api-error';
import { ENDPOINTS } from './endpoints';
import { sessionStore } from './session-store';

export type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[];
export type QueryParams = Record<string, QueryValue>;

export interface RequestOptions {
  params?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
  /** Required by the contract on payments, refunds, send-to-kitchen, purchase receive. */
  idempotencyKey?: string;
  /** Public/auth endpoints: do not attach Bearer and do not try to refresh on 401. */
  skipAuth?: boolean;
  /** Override X-Branch-Id (null = do not send). Defaults to the current branch. */
  branchId?: string | null;
  headers?: Record<string, string>;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export function buildUrl(path: string, params?: QueryParams): string {
  const url = new URL(`${env.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      if (value.length > 0) url.searchParams.set(key, value.join(','));
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function buildHeaders(options: RequestOptions): Headers {
  const headers = new Headers({ Accept: 'application/json', 'Accept-Language': sessionStore.getLanguage() });
  const token = sessionStore.getAccessToken();
  if (token && !options.skipAuth) headers.set('Authorization', `Bearer ${token}`);
  const branchId = options.branchId === undefined ? sessionStore.getBranchId() : options.branchId;
  if (branchId) headers.set('X-Branch-Id', branchId);
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
  if (options.body !== undefined && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  Object.entries(options.headers ?? {}).forEach(([key, value]) => headers.set(key, value));
  return headers;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
}

async function send(method: Method, path: string, options: RequestOptions): Promise<Response> {
  const body =
    options.body === undefined ? undefined : options.body instanceof FormData ? options.body : JSON.stringify(options.body);
  try {
    return await fetch(buildUrl(path, options.params), {
      method,
      headers: buildHeaders(options),
      body,
      signal: options.signal,
      credentials: 'include',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw networkError(error);
  }
}

/** Backoff between refresh attempts when the server is unreachable / overloaded (429, 5xx, network). */
export const REFRESH_RETRY_DELAYS_MS = [1_000, 3_000, 7_000] as const;

/** Only these mean "the refresh token is invalid or revoked" → the user must sign in again. */
const isInvalidRefresh = (status: number) => status === 401 || status === 403;
/** Network error (status 0), timeout, rate limit, server errors: worth retrying. */
const isRetryable = (error: unknown) =>
  isApiError(error) && (error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500);

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One attempt: AuthResponse on success, null when the refresh token is rejected; throws ApiError when transient. */
async function attemptRefresh(): Promise<AuthResponse | null> {
  const response = await send('POST', ENDPOINTS.auth.refresh, { skipAuth: true, branchId: null });
  const data = await parseBody(response);
  if (isInvalidRefresh(response.status)) return null;
  if (!response.ok) throw apiErrorFromProblem(response.status, data, response.headers.get('X-Correlation-Id'));
  const auth = data as AuthResponse | undefined;
  if (!auth?.accessToken) return null;
  sessionStore.setAccessToken(auth.accessToken);
  return auth;
}

let refreshInFlight: Promise<AuthResponse | null> | null = null;

/**
 * Single-flight refresh: concurrent 401s share ONE `POST /auth/refresh` (the refresh token rotates,
 * so parallel refreshes would trigger reuse detection and revoke the family).
 * Resolves `null` only when the refresh token is invalid/revoked (401/403). On 429/5xx/network errors it
 * retries with backoff (keeping the in-memory session) and finally rejects with the last ApiError.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= (async () => {
    try {
      for (let attempt = 0; ; attempt += 1) {
        try {
          const auth = await attemptRefresh();
          if (attempt > 0) sessionStore.notifyConnectionRestored();
          return auth;
        } catch (error) {
          const delay = REFRESH_RETRY_DELAYS_MS[attempt];
          if (delay === undefined || !isRetryable(error)) throw error;
          if (attempt === 0) sessionStore.notifyConnectionLost();
          await wait(delay);
        }
      }
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(method, path, options);

  if (response.status === 401 && !options.skipAuth) {
    // Transient refresh failures reject here (network/server error) WITHOUT ending the session.
    const refreshed = await refreshSession();
    if (!refreshed) {
      sessionStore.notifySessionExpired();
      throw apiErrorFromProblem(401, await parseBody(response), response.headers.get('X-Correlation-Id'));
    }
    response = await send(method, path, options);
  }

  const data = await parseBody(response);
  if (!response.ok) throw apiErrorFromProblem(response.status, data, response.headers.get('X-Correlation-Id'));
  return data as T;
}

/** The ONE api client. Feature hooks call these; components never call fetch directly. */
export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PATCH', path, { ...options, body }),
  delete: <T = void>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
};
