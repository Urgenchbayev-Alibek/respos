import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ElectronApplication } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchApp, webAppWindow } from './helpers/launch';

/**
 * The shell against a real RestaurantOS backend (Development seed). Skipped unless the server address is given:
 *   RESPOS_E2E_SERVER_URL=http://localhost:5081 npm run e2e
 * Optional: RESPOS_E2E_EMAIL / RESPOS_E2E_PASSWORD (default: the demo cashier). One login per run — the API
 * limits logins to 5 per minute per e-mail.
 */
const serverUrl = process.env.RESPOS_E2E_SERVER_URL;
const email = process.env.RESPOS_E2E_EMAIL ?? 'cashier@demo.respos.uz';
const password = process.env.RESPOS_E2E_PASSWORD ?? 'Demo123!';

interface ApiResult {
  status: number;
  body: unknown;
}

describe.skipIf(!serverUrl)('desktop shell ↔ real backend', () => {
  let workDir: string;
  let app: ElectronApplication;

  beforeAll(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'respos-desktop-backend-'));
    await writeFile(path.join(workDir, 'settings.json'), JSON.stringify({ serverUrl }));
    app = await launchApp(workDir);
  });

  afterAll(async () => {
    await app.close().catch(() => undefined);
    await rm(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  it('logs in, refreshes through the httpOnly cookie and talks to the SignalR hub — all same-origin', async () => {
    const web = await webAppWindow(app);

    const call = (method: string, url: string, token?: string, json?: unknown): Promise<ApiResult> =>
      web.evaluate(
        async (request) => {
          const headers: Record<string, string> = {};
          if (request.json !== undefined) headers['Content-Type'] = 'application/json';
          if (request.token) headers.Authorization = `Bearer ${request.token}`;
          const response = await fetch(request.url, {
            method: request.method,
            headers,
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
        { method, url, token, json },
      );

    expect((await call('GET', '/health/ready')).status).toBe(200);

    const login = await call('POST', '/api/v1/auth/login', undefined, { email, password });
    expect(login.status, JSON.stringify(login.body)).toBe(200);
    const session = login.body as { accessToken: string; user: { email: string } };
    expect(session.user.email).toBe(email);

    // The refresh cookie is stored for the gateway origin, invisible to scripts.
    const cookies = await app.evaluate(({ session: electronSession }) => electronSession.defaultSession.cookies.get({ name: 'refresh_token' }));
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({ domain: '127.0.0.1', path: '/api/v1/auth', httpOnly: true, secure: false, sameSite: 'lax' });
    expect(await web.evaluate(() => document.cookie)).not.toContain('refresh_token');

    // Cookie round trip: refresh works without any token in the request.
    const refresh = await call('POST', '/api/v1/auth/refresh');
    expect(refresh.status, JSON.stringify(refresh.body)).toBe(200);
    const accessToken = (refresh.body as { accessToken: string }).accessToken;
    expect(accessToken).toBeTruthy();

    const me = await call('GET', '/api/v1/auth/me', accessToken);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email });

    // SignalR: negotiate over HTTP, then the WebSocket transport through the gateway tunnel.
    const negotiate = await call('POST', '/hubs/restaurant/negotiate?negotiateVersion=1', accessToken);
    expect(negotiate.status, JSON.stringify(negotiate.body)).toBe(200);
    const connectionToken = (negotiate.body as { connectionToken: string }).connectionToken;
    const handshake = await web.evaluate(
      ({ id, token }) =>
        new Promise<string>((resolve, reject) => {
          const query = `id=${encodeURIComponent(id)}&access_token=${encodeURIComponent(token)}`;
          const socket = new WebSocket(`ws://${window.location.host}/hubs/restaurant?${query}`);
          socket.onopen = () => socket.send('{"protocol":"json","version":1}\u001e');
          socket.onmessage = (event) => {
            resolve(String(event.data));
            socket.close();
          };
          socket.onerror = () => reject(new Error('hub websocket failed'));
          socket.onclose = (event) => reject(new Error(`hub websocket closed (${event.code})`));
        }),
      { id: connectionToken, token: accessToken },
    );
    expect(handshake).toBe('{}\u001e');

    const logout = await call('POST', '/api/v1/auth/logout', accessToken);
    expect([200, 204]).toContain(logout.status);
    expect((await call('POST', '/api/v1/auth/refresh')).status).toBe(401);
  });
});
