import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, http, HttpResponse, problem, server } from '@/test/msw-server';
import { apiClient, buildUrl } from './api-client';
import { ApiError } from './api-error';
import { sessionStore } from './session-store';

const authResponse = (token: string) => ({
  accessToken: token,
  expiresAt: new Date(Date.now() + 900_000).toISOString(),
  user: { id: 'u1' },
});

afterEach(() => {
  sessionStore.setAccessToken(null);
  sessionStore.setBranchId(null);
});

describe('apiClient request context', () => {
  it('sends Bearer, X-Branch-Id, Accept-Language, Idempotency-Key and cookies', async () => {
    sessionStore.setAccessToken('token-1');
    sessionStore.setBranchId('branch-1');
    let captured: Request | undefined;
    server.use(
      http.post(api('/payments'), ({ request }) => {
        captured = request;
        return HttpResponse.json({ id: 'p1' }, { status: 201 });
      }),
    );

    await apiClient.post('/payments', { amount: 1000 }, { idempotencyKey: 'key-123' });

    expect(captured?.headers.get('Authorization')).toBe('Bearer token-1');
    expect(captured?.headers.get('X-Branch-Id')).toBe('branch-1');
    expect(captured?.headers.get('Accept-Language')).toBe('ru');
    expect(captured?.headers.get('Idempotency-Key')).toBe('key-123');
    expect(captured?.headers.get('Content-Type')).toBe('application/json');
    expect(captured?.credentials).toBe('include');
  });

  it('omits X-Branch-Id when branchId is null and skips empty query params', async () => {
    sessionStore.setBranchId('branch-1');
    let captured: Request | undefined;
    server.use(
      http.get(api('/users'), ({ request }) => {
        captured = request;
        return HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0 });
      }),
    );
    await apiClient.get('/users', { branchId: null, params: { search: '', status: undefined, page: 2, ids: ['a', 'b'] } });
    expect(captured?.headers.get('X-Branch-Id')).toBeNull();
    expect(new URL(captured?.url ?? '').search).toBe('?page=2&ids=a%2Cb');
  });

  it('builds URLs relative to the configured base', () => {
    expect(buildUrl('/orders', { status: ['new', 'ready'] })).toBe('http://api.test/api/v1/orders?status=new%2Cready');
  });

  it('returns undefined for 204', async () => {
    server.use(http.delete(api('/roles/r1'), () => new HttpResponse(null, { status: 204 })));
    await expect(apiClient.delete('/roles/r1')).resolves.toBeUndefined();
  });
});

describe('apiClient refresh on 401', () => {
  it('refreshes once for concurrent 401s and retries each request', async () => {
    sessionStore.setAccessToken('expired');
    const refresh = vi.fn(() => HttpResponse.json(authResponse('fresh')));
    server.use(
      http.post(api('/auth/refresh'), refresh),
      http.get(api('/orders'), ({ request }) =>
        request.headers.get('Authorization') === 'Bearer fresh' ? HttpResponse.json({ ok: 1 }) : problem(401, 'auth.unauthenticated'),
      ),
    );

    const results = await Promise.all([apiClient.get('/orders'), apiClient.get('/orders'), apiClient.get('/orders')]);

    expect(results).toEqual([{ ok: 1 }, { ok: 1 }, { ok: 1 }]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(sessionStore.getAccessToken()).toBe('fresh');
  });

  it('notifies session expiry and throws 401 when refresh fails', async () => {
    sessionStore.setAccessToken('expired');
    const onExpired = vi.fn();
    const unsubscribe = sessionStore.onSessionExpired(onExpired);
    server.use(
      http.post(api('/auth/refresh'), () => problem(401, 'auth.invalid_token')),
      http.get(api('/orders'), () => problem(401, 'auth.unauthenticated')),
    );

    await expect(apiClient.get('/orders')).rejects.toMatchObject({ status: 401, code: 'auth.unauthenticated' });
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(sessionStore.getAccessToken()).toBeNull();
    unsubscribe();
  });

  it('does not refresh for skipAuth requests (login)', async () => {
    const refresh = vi.fn(() => HttpResponse.json(authResponse('x')));
    server.use(
      http.post(api('/auth/refresh'), refresh),
      http.post(api('/auth/login'), () => problem(401, 'auth.invalid_credentials')),
    );
    await expect(apiClient.post('/auth/login', {}, { skipAuth: true })).rejects.toMatchObject({ code: 'auth.invalid_credentials' });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('ProblemDetails parsing', () => {
  it('maps code, status, correlationId and camelCases field errors', async () => {
    server.use(
      http.post(api('/users'), () =>
        problem(400, 'validation.failed', {
          correlationId: 'corr-1',
          errors: { Email: ['Email is taken'], 'Items[0].Quantity': ['Must be positive'] },
        }),
      ),
    );
    const error = await apiClient.post('/users', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.code).toBe('validation.failed');
    expect(apiError.correlationId).toBe('corr-1');
    expect(apiError.fieldErrors).toEqual({ email: ['Email is taken'], 'items[0].quantity': ['Must be positive'] });
    expect(apiError.isValidation).toBe(true);
  });

  it('falls back to a status-based code for non-JSON errors', async () => {
    server.use(http.get(api('/dashboard'), () => new HttpResponse('Bad gateway', { status: 502 })));
    await expect(apiClient.get('/dashboard')).rejects.toMatchObject({ status: 502, code: 'server.error' });
  });

  it('wraps network failures as network.error', async () => {
    server.use(http.get(api('/dashboard'), () => HttpResponse.error()));
    await expect(apiClient.get('/dashboard')).rejects.toMatchObject({ status: 0, code: 'network.error' });
  });
});
