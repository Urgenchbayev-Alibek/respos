import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, describe, expect, it } from 'vitest';
import { APP_DIR, freeGatewayPort, isSettingsPage, isWebAppPage, launchApp, runSecondInstance, webAppWindow } from '../helpers/launch';
import { ACCOUNTS, SCENARIO_DIR, SCENARIO_KEY, SERVER_URL, api, loginWithPassword, startApp, waitFor, type StartedApp } from './helpers/scenario';

const run = promisify(execFile);

const PREFERRED_GATEWAY_PORT = 47615; // src/gateway/local-gateway.ts
const LOGIN_FORM = 'Вход в RestaurantOS';
const DASHBOARD = 'Дашборд';
/** Connection window (src/settings-ui/i18n.ts, Russian). */
const SERVER_ADDRESS = 'Адрес сервера';
const REASON_FIRST_RUN = 'Укажите адрес сервера RestaurantOS, чтобы начать работу.';
const REASON_UNREACHABLE = 'Сервер недоступен. Проверьте адрес и сеть — программа подключится сама, как только сервер ответит.';
// The admin panel renders no realtime indicator (only the kitchen and workspace layouts do, see the README's
// known gaps), so the state of the connection is read from the hub socket and the gateway's answers.
const SLOW = 300_000;

/** Stops / starts this scenario's own API (the database is kept). */
async function stack(command: 'stop-api' | 'start-api'): Promise<void> {
  await run(process.execPath, ['scripts/scenario-stack.mjs', command, SCENARIO_KEY], { cwd: APP_DIR, timeout: 280_000 });
}

/** A dummy listener on the loopback port, or `null` when something else already holds it. */
function occupy(port: number): Promise<net.Server | null> {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => socket.destroy());
    server.once('error', () => resolve(null));
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

describe('resilience: server down / up, busy port, second instance, session persistence', () => {
  const stamp = Date.now();
  const mainProfile = `main-${stamp}`;
  const observations: Record<string, unknown> = {};
  const launched: ElectronApplication[] = [];
  let gatewayPort = 0;
  let main: StartedApp | undefined;
  let downApp: ElectronApplication | undefined;
  let blocker: net.Server | null = null;
  let apiStopped = false;
  let loginRequests = 0;

  const profileDir = (name: string): string => path.join(SCENARIO_DIR, 'profiles', name);
  const shot = (page: Page, name: string): Promise<unknown> =>
    page.screenshot({ path: path.join(SCENARIO_DIR, `${name}.png`) }).catch(() => undefined);
  const countLogins = (page: Page): void => {
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/v1/auth/login')) loginRequests += 1;
    });
  };
  const dashboard = (page: Page, timeout = 90_000): Promise<void> =>
    page.getByRole('heading', { level: 1, name: DASHBOARD }).waitFor({ state: 'visible', timeout });
  const windowCount = (app: ElectronApplication): Promise<number> =>
    app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
  const connectionWindow = async (app: ElectronApplication): Promise<Page> => {
    const page = await waitFor('the connection window', () => app.windows().find(isSettingsPage), 90_000);
    await page.getByLabel(SERVER_ADDRESS).waitFor({ state: 'visible', timeout: 60_000 });
    return page;
  };
  /** The shell's own log of a profile (userData/logs/*). */
  const shellLog = (dir: string): string => {
    const logs = path.join(dir, 'logs');
    if (!existsSync(logs)) return '';
    return readdirSync(logs).map((name) => readFileSync(path.join(logs, name), 'utf8')).join('\n');
  };
  const mainApp = (): StartedApp => {
    if (!main) throw new Error('The signed-in app is not running (an earlier step failed)');
    return main;
  };

  afterAll(async () => {
    await main?.close();
    for (const app of launched) await app.close().catch(() => undefined);
    await new Promise<void>((resolve) => (blocker ? blocker.close(() => resolve()) : resolve()));
    if (apiStopped) await stack('start-api').catch(() => undefined);
    await writeFile(path.join(SCENARIO_DIR, 'observations.json'), JSON.stringify(observations, null, 2));
    console.info(`[resilience] observations: ${JSON.stringify(observations)}`);
  }, SLOW);

  it('6. a truncated settings.json leads to the connection window, not a crash', async () => {
    const dir = profileDir(`corrupt-${stamp}`);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'settings.json'), `{"serverUrl":"${SERVER_URL}","langu`);
    const app = await launchApp(dir);
    launched.push(app);
    const page = await connectionWindow(app);
    await page.getByText(REASON_FIRST_RUN).waitFor({ state: 'visible', timeout: 30_000 });
    await shot(page, '6-corrupt-settings');
    expect(await page.getByLabel(SERVER_ADDRESS).inputValue()).toBe('');
    expect(app.windows().filter(isWebAppPage)).toHaveLength(0);
    // The broken file is set aside, not silently overwritten (settings-store.ts).
    expect(existsSync(path.join(dir, 'settings.corrupt.json'))).toBe(true);
    expect(shellLog(dir)).toContain('settings file is not valid JSON');
    await app.close();
  });

  it('baseline: signs in once as the admin, realtime is online', async () => {
    gatewayPort = await freeGatewayPort();
    main = await startApp({ profile: mainProfile, gatewayPort });
    const { page, monitor } = main;
    countLogins(page);
    await page.getByRole('form', { name: LOGIN_FORM }).waitFor({ state: 'visible', timeout: 60_000 });
    monitor.reset();
    await loginWithPassword(page, ACCOUNTS.admin);
    await dashboard(page);
    await waitFor('a live SignalR socket', () => monitor.liveWebSockets.some((url) => url.includes('/hubs/')), 60_000);
    expect(loginRequests).toBe(1);
    expect(monitor.errors).toEqual([]);
  });

  it('4. a second instance on the same profile exits and brings the first window back', async () => {
    const { app, userDataDir } = mainApp();
    if (!app) throw new Error('The development build exposes the Electron handle');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.minimize());
    await waitFor('the window to minimise', () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMinimized()));
    const exitCode = await runSecondInstance(userDataDir);
    expect(exitCode).toBe(0);
    await waitFor(
      'the first window to be restored',
      () => app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        return window !== undefined && !window.isMinimized() && window.isVisible();
      }),
      30_000,
    );
    expect(await windowCount(app)).toBe(1);
    // Windows may refuse to hand the foreground to a background process: recorded, not asserted.
    observations.firstWindowFocusedAfterSecondInstance = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow() !== null);
  });

  it('2a. signed in, the server goes down: the app stays on its screen and shows an offline state', async () => {
    const { page, monitor } = mainApp();
    monitor.reset();
    await stack('stop-api');
    apiStopped = true;
    await waitFor('the gateway to report the server as unreachable', async () => (await api(page, 'GET', '/health/ready')).status >= 502, 90_000);
    observations.offlineIndicator = 'none: the admin layout has no realtime indicator';
    await shot(page, '2a-server-down');
    expect(new URL(page.url()).pathname.startsWith('/login')).toBe(false);
    await dashboard(page, 10_000);
    expect(await page.getByRole('form', { name: LOGIN_FORM }).count()).toBe(0);
    // The gateway itself answers (problem+json) instead of hanging or dropping the connection.
    const probe = await api(page, 'GET', '/health/ready');
    observations.gatewayStatusWhileServerDown = probe.status;
    observations.gatewayBodyWhileServerDown = probe.body;
    expect([502, 503, 504]).toContain(probe.status);
  }, SLOW);

  it('1a. started while the server is down: connection window with the "unreachable" message', async () => {
    expect(apiStopped).toBe(true);
    const dir = profileDir(`down-${stamp}`);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'settings.json'), JSON.stringify({ serverUrl: SERVER_URL }));
    downApp = await launchApp(dir);
    launched.push(downApp);
    const page = await connectionWindow(downApp);
    await page.getByText(REASON_UNREACHABLE).waitFor({ state: 'visible', timeout: 30_000 });
    await shot(page, '1a-unreachable');
    expect(await page.getByLabel(SERVER_ADDRESS).inputValue()).toBe(SERVER_URL);
    expect(downApp.windows().filter(isWebAppPage)).toHaveLength(0);
    expect(shellLog(dir)).toContain('server is not reachable at startup');
  });

  it('1b. the server returns: the app leaves the connection window by itself and shows the login form', async () => {
    if (!downApp) throw new Error('Step 1a did not start the app');
    await stack('start-api');
    apiStopped = false;
    const web = await webAppWindow(downApp, 120_000);
    await web.getByRole('form', { name: LOGIN_FORM }).waitFor({ state: 'visible', timeout: 90_000 });
    await shot(web, '1b-recovered');
    const app = downApp;
    await waitFor('the connection window to close', () => app.windows().filter(isSettingsPage).length === 0, 30_000);
    await app.close();
  }, SLOW);

  it('2b. the server returns: the session continues without a new login and SignalR reconnects', async () => {
    const { page, monitor } = mainApp();
    expect(apiStopped).toBe(false);
    // Reconnect back-off is capped at 30 s (hub-manager.ts).
    await shot(page, '2b-server-back');
    expect(new URL(page.url()).pathname.startsWith('/login')).toBe(false);
    expect(await page.getByRole('form', { name: LOGIN_FORM }).count()).toBe(0);
    await dashboard(page, 10_000);
    const me = await api<{ email: string }>(page, 'GET', '/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(ACCOUNTS.admin);
    // The refresh cookie still works through the gateway.
    const refreshed = await api<{ accessToken?: string }>(page, 'POST', '/api/v1/auth/refresh');
    expect(refreshed.status).toBe(200);
    // monitor.reset() ran before the stop: a live hub socket here is a new one.
    await waitFor('a new live SignalR socket', () => monitor.liveWebSockets.some((url) => url.includes('/hubs/')), 60_000);
    expect(loginRequests).toBe(1);
  }, SLOW);

  it('5. quit and relaunch on the same profile: still signed in', async () => {
    await mainApp().close();
    main = await startApp({ profile: mainProfile, gatewayPort });
    const { page } = main;
    countLogins(page);
    const state = await waitFor(
      'the dashboard or the login form',
      async () => {
        if ((await page.getByRole('heading', { level: 1, name: DASHBOARD }).count()) > 0) return 'signed-in';
        return (await page.getByRole('form', { name: LOGIN_FORM }).count()) > 0 ? 'login-form' : null;
      },
      120_000,
    );
    await shot(page, '5-relaunch');
    observations.sessionAfterRelaunch = state;
    expect(state).toBe('signed-in');
    const me = await api<{ email: string }>(page, 'GET', '/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(loginRequests).toBe(1);
  }, SLOW);

  it('3. the preferred gateway port 47615 is busy: the app starts on another port and works', async (context) => {
    blocker = await occupy(PREFERRED_GATEWAY_PORT);
    if (!blocker) {
      observations.busyPort = `skipped: port ${PREFERRED_GATEWAY_PORT} is held by another application`;
      context.skip();
      return;
    }
    const before = mainApp();
    const originBefore = new URL(before.page.url()).origin;
    const storageBefore = await before.page.evaluate(() => Object.keys(window.localStorage).sort());
    await before.close();

    main = await startApp({ profile: mainProfile, gatewayPort: PREFERRED_GATEWAY_PORT });
    const { page, userDataDir } = main;
    countLogins(page);
    const origin = new URL(page.url()).origin;
    expect(origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(origin).not.toBe(`http://127.0.0.1:${PREFERRED_GATEWAY_PORT}`);
    expect(origin).not.toBe(originBefore);
    expect(shellLog(userDataDir)).toContain(`port ${PREFERRED_GATEWAY_PORT} is unavailable`);

    const state = await waitFor(
      'the dashboard or the login form',
      async () => {
        if ((await page.getByRole('heading', { level: 1, name: DASHBOARD }).count()) > 0) return 'signed-in';
        return (await page.getByRole('form', { name: LOGIN_FORM }).count()) > 0 ? 'login-form' : null;
      },
      120_000,
    );
    await shot(page, '3-busy-port');
    const storageAfter = await page.evaluate(() => Object.keys(window.localStorage).sort());
    observations.busyPort = {
      originBefore,
      originAfter: origin,
      sessionAfterOriginChange: state,
      localStorageKeysBefore: storageBefore,
      localStorageKeysAfter: storageAfter,
    };

    // "Works": the API is reachable through the new origin; a lost session is recovered with a normal login.
    const health = await api(page, 'GET', '/health/ready');
    expect(health.status).toBe(200);
    if (state === 'login-form') await loginWithPassword(page, ACCOUNTS.admin);
    await dashboard(page);
    const me = await api<{ email: string }>(page, 'GET', '/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(ACCOUNTS.admin);
  }, SLOW);
});
