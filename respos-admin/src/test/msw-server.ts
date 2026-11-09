import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { env } from '@/shared/config/env';

/** API base for handlers: `http.get(api('/users'), ...)`. */
export const api = (path: string) => `${env.apiBaseUrl}${path}`;

/** No default handlers: each test declares what the API returns (unhandled requests fail the test). */
export const server = setupServer();

export function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json(
    { type: `https://respos.dev/errors/${code}`, title: code, status, code, ...extra },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

export { http, HttpResponse };
