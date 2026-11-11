import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closedPort } from '../tests/helpers/fake-upstream';
import {
  APP_DIR,
  clickClosing,
  freeGatewayPort,
  isSettingsPage,
  launchApp,
  settingsWindow,
  waitUntilClosed,
  webAppWindow,
} from './helpers/launch';
import { monitorPage, type PageMonitor } from './helpers/page-monitor';
import { type BackendRelay, startBackendRelay } from './helpers/relay';

/**
 * The real thing end to end: the built web app (`web-dist/`, `npm run build:web`) inside the shell, against a
 * real RestaurantOS backend (Development seed). Skipped unless the server address is given:
 *   RESPOS_E2E_SERVER_URL=http://localhost:5081 npm run e2e
 * One profile folder is used by the whole file — the tests are one scenario and run in order. The app talks to
 * the backend through a TCP relay, so "the server went down" can be played without stopping the backend.
 * One password login per run (the API allows 5 per minute per e-mail).
 */
const serverUrl = process.env.RESPOS_E2E_SERVER_URL;
const email = process.env.RESPOS_E2E_ADMIN_EMAIL ?? 'admin@demo.respos.uz';
const password = process.env.RESPOS_E2E_PASSWORD ?? 'Demo123!';

const REALTIME_INDICATOR = '[role="status"][title]';
const ONLINE = 'Онлайн';

interface CapturedJob {
  paper: string;
  silent: boolean;
  deviceName: string | null;
  pageSize: unknown;
  page: string;
}

type DesktopBridge = { resposDesktop: { print(options?: { paper?: string }): Promise<unknown> } };

describe.skipIf(!serverUrl)('real web app in the shell ↔ real backend', () => {
  let workDir: string;
  let profile: string;
  let printCaptureFile: string;
  let gatewayPort: number;
  let relay: BackendRelay;
  let app: ElectronApplication;
  let web: Page;
  let monitor: PageMonitor;

  const launch = async (): Promise<void> => {
    app = await launchApp(profile, { gatewayPort, printCaptureFile });
  };
  const savedSettings = async (): Promise<Record<string, unknown>> =>
    JSON.parse(await readFile(path.join(profile, 'settings.json'), 'utf8')) as Record<string, unknown>;
  const printedJobs = async (): Promise<CapturedJob[]> => {
    const text = await readFile(printCaptureFile, 'utf8').catch(() => '');
    return text.split('\n').filter((line) => line !== '').map((line) => JSON.parse(line) as CapturedJob);
  };
  const gatewayUrl = (pathname: string): string => `http://127.0.0.1:${gatewayPort}${pathname}`;
  const heading = (): Promise<string | null> => web.locator('h1').first().textContent();

  beforeAll(async () => {
    if (!existsSync(path.join(APP_DIR, 'web-dist', 'index.html'))) {
      throw new Error('web-dist/ is missing: run "npm run build:web" before the end-to-end scenario');
    }
    workDir = await mkdtemp(path.join(tmpdir(), 'respos-desktop-app-'));
    profile = path.join(workDir, 'profile');
    printCaptureFile = path.join(workDir, 'print-jobs.jsonl');
    gatewayPort = await freeGatewayPort();
    relay = await startBackendRelay(serverUrl ?? '');
  });

  afterAll(async () => {
    await app?.close().catch(() => undefined);
    await relay?.stop();
    if (workDir) await rm(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  it('first run: asks for the server, explains a dead address, opens the web app once the address is saved', async () => {
    await launch();
    const settings = await settingsWindow(app);
    expect(app.windows()).toHaveLength(1);
    expect(await settings.locator('#reason').textContent()).toContain('Укажите адрес сервера');

    await settings.fill('#server-url', `http://127.0.0.1:${await closedPort()}`);
    await settings.click('#test-button');
    await settings.waitForSelector('#test-status[data-kind="error"]');
    expect(await settings.locator('#test-status').textContent()).toContain('Сервер недоступен');
    expect(existsSync(path.join(profile, 'settings.json'))).toBe(false);

    await settings.fill('#server-url', relay.origin);
    await settings.click('#test-button');
    await settings.waitForSelector('#test-status[data-kind="ok"]');
    await clickClosing(settings, '#save-button');

    web = await webAppWindow(app);
    await waitUntilClosed(app, isSettingsPage);
    expect(app.windows()).toHaveLength(1);
    expect((await savedSettings()).serverUrl).toBe(relay.origin);

    // The real web app, served by the gateway: its sign-in form, not the placeholder page.
    await web.waitForSelector('input[type="email"]');
    expect(web.url()).toBe(gatewayUrl('/login'));
    expect(await heading()).toBe('Вход в RestaurantOS');
    expect(await web.locator('[data-testid="desktop-placeholder"]').count()).toBe(0);
    // A desktop build has no service worker (the shell replaces the bundled files itself).
    expect(await web.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  });

  it('signs in: the dashboard renders with no console errors and no failed requests, realtime runs through the gateway', async () => {
    // From here on: the "no session yet" 401 of the start-up refresh probe is behind us.
    monitor = monitorPage(web);
    await web.fill('input[type="email"]', email);
    await web.fill('input[type="password"]', password);
    await web.click('button[type="submit"]');

    await web.waitForURL(gatewayUrl('/admin'));
    await web.waitForSelector('h1');
    expect(await heading()).toBe('Дашборд');
    // The dashboard has loaded its numbers (not an error state, not an endless spinner).
    await web.getByText('Занятость столов').waitFor();
    await web.waitForLoadState('networkidle');

    // SignalR: negotiated and upgraded to a WebSocket on the gateway origin, and the hub answered.
    await expect.poll(() => monitor.liveWebSockets, { timeout: 15_000 }).toHaveLength(1);
    expect(monitor.liveWebSockets[0]).toMatch(new RegExp(`^ws://127\\.0\\.0\\.1:${gatewayPort}/hubs/restaurant\\?`));

    expect(monitor.errors).toEqual([]);
    expect(monitor.failedRequests).toEqual([]);

    const cookies = await app.evaluate(({ session }) => session.defaultSession.cookies.get({ name: 'refresh_token' }));
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({ domain: '127.0.0.1', path: '/api/v1/auth', httpOnly: true, secure: false, sameSite: 'lax' });
    expect(cookies[0]?.session).toBe(false);
    expect(await web.evaluate(() => document.cookie)).not.toContain('refresh_token');
  });

  it('keeps the session over a page reload and shows the realtime indicator online', async () => {
    monitor.reset();
    await web.reload();
    await web.waitForSelector('h1');
    expect(web.url()).toBe(gatewayUrl('/admin'));
    expect(await heading()).toBe('Дашборд');
    expect(await web.locator('input[type="password"]').count()).toBe(0);

    // The waiter workspace shows the connection indicator in its top bar.
    await web.goto(gatewayUrl('/waiter'));
    await web.locator(`${REALTIME_INDICATOR}[title="${ONLINE}"]`).waitFor();
    await web.waitForLoadState('networkidle');
    expect(monitor.errors).toEqual([]);
    expect(monitor.failedRequests).toEqual([]);
  });

  it('prints through the bridge: the job reaches the main process with the right paper and printer', async () => {
    // The QR sheet button of the web app → resposDesktop.print({ paper: 'a4' }) → system dialog, never silent.
    await web.goto(gatewayUrl('/admin/tables/qr'));
    const printButton = web.getByRole('button', { name: /^Печать \(\d+\)$/ });
    await printButton.waitFor();
    await expect.poll(() => printButton.isEnabled()).toBe(true);
    await printButton.click();
    await expect.poll(printedJobs).toHaveLength(1);
    expect((await printedJobs())[0]).toMatchObject({ paper: 'a4', silent: false, deviceName: null, pageSize: 'A4', page: '/admin/tables/qr' });

    // A receipt without a configured printer → the dialog as well.
    const printReceipt = (): Promise<unknown> =>
      web.evaluate(() => (window as unknown as DesktopBridge).resposDesktop.print({ paper: 'receipt-80mm' }));
    expect(await printReceipt()).toEqual({ ok: true });
    expect((await printedJobs())[1]).toMatchObject({ paper: 'receipt-80mm', silent: false, deviceName: null });

    // Choose a printer in the connection window (opened from the web app's user menu) and turn silent printing on.
    await web.getByRole('button', { name: 'Меню пользователя' }).click();
    await web.getByRole('menuitem', { name: 'Настройки подключения' }).click();
    const settings = await settingsWindow(app);
    expect(await settings.inputValue('#server-url')).toBe(relay.origin);
    const printers = await settings.locator('#printer option').evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value).filter((value) => value !== ''),
    );
    const printer = printers[0];
    if (printer === undefined) {
      // No printer is installed on this machine: the silent path cannot be reached (covered by tests/printing.test.ts).
      await clickClosing(settings, '#cancel-button');
      await waitUntilClosed(app, isSettingsPage);
      return;
    }
    await settings.selectOption('#printer', printer);
    await settings.check('#silent-print');
    await clickClosing(settings, '#save-button');
    await waitUntilClosed(app, isSettingsPage);
    expect(await savedSettings()).toMatchObject({ printer, silentPrint: true, serverUrl: relay.origin });
    // The server did not change: the web app was not reloaded and the user is still signed in.
    expect(web.url()).toBe(gatewayUrl('/admin/tables/qr'));

    expect(await printReceipt()).toEqual({ ok: true });
    const receipt = (await printedJobs())[2];
    expect(receipt).toMatchObject({ paper: 'receipt-80mm', silent: true, deviceName: printer });
    expect(receipt?.pageSize).toMatchObject({ width: 80_000 });
    // An A4 sheet still goes through the dialog, not to the receipt printer.
    expect(await web.evaluate(() => (window as unknown as DesktopBridge).resposDesktop.print({ paper: 'a4' }))).toEqual({ ok: true });
    expect((await printedJobs())[3]).toMatchObject({ paper: 'a4', silent: false, deviceName: null });
  });

  it('exports a report: Excel is saved as a file, the PDF print layout loads in its frame and is printed', async () => {
    // Without a handler Electron asks where to save; the test answers that question itself.
    const downloads = path.join(workDir, 'downloads');
    await mkdir(downloads);
    await app.evaluate(
      ({ session }, target) => {
        // A native path: with forward slashes the download is reported as interrupted on Windows.
        session.defaultSession.on('will-download', (_event, item) =>
          item.setSavePath(`${target.directory}${target.separator}${item.getFilename()}`),
        );
      },
      { directory: downloads, separator: path.sep },
    );

    monitor.reset();
    await web.goto(gatewayUrl('/admin/reports'));
    const exportButton = web.getByRole('button', { name: 'Экспорт' }).first();
    await exportButton.click();
    await web.getByRole('menuitem', { name: 'Excel (XLSX)' }).click();
    const savedFile = async (): Promise<string> => {
      const [name] = await readdir(downloads);
      if (name === undefined || !/^sales-summary_.+\.xlsx$/.test(name)) return name ?? '';
      // An .xlsx file is a zip archive.
      return (await readFile(path.join(downloads, name))).subarray(0, 2).toString('latin1');
    };
    await expect.poll(savedFile, { timeout: 15_000 }).toBe('PK');

    // "PDF / print": the server's print layout is framed from a blob: URL and printed from that frame. The
    // frame's print() is replaced (a capturing listener runs before the app's own onload) so no dialog opens.
    await web.evaluate(() => {
      const printed: string[] = [];
      (window as unknown as { e2ePrintedFrames: string[] }).e2ePrintedFrames = printed;
      document.addEventListener(
        'load',
        (event) => {
          const frame = event.target;
          if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow) return;
          const text = frame.contentDocument?.body.innerText ?? '';
          frame.contentWindow.print = () => {
            printed.push(text);
          };
        },
        true,
      );
    });
    await exportButton.click();
    await web.getByRole('menuitem', { name: 'PDF / печать' }).click();
    const printedFrames = (): Promise<string[]> => web.evaluate(() => (window as unknown as { e2ePrintedFrames: string[] }).e2ePrintedFrames);
    await expect.poll(printedFrames, { timeout: 15_000 }).toHaveLength(1);
    expect((await printedFrames())[0]).toContain('Сводка продаж');
    // In particular: no Content-Security-Policy violation for the framed blob: document.
    expect(monitor.errors).toEqual([]);
    expect(monitor.failedRequests).toEqual([]);
  });

  it('uploads a menu photo through the gateway and shows it from the server files', async () => {
    monitor.reset();
    // The upload is made with the session of the signed-in app: a fresh access token from the refresh cookie.
    const png = (await readFile(path.join(APP_DIR, 'assets', 'icon.png'))).toString('base64');
    const uploaded = await web.evaluate(async (pngBase64) => {
      const json = async (response: Response): Promise<Record<string, unknown>> => (await response.json()) as Record<string, unknown>;
      const session = await json(await fetch('/api/v1/auth/refresh', { method: 'POST' }));
      const headers = { Authorization: `Bearer ${String(session.accessToken)}` };
      const list = await json(await fetch('/api/v1/menu/items?page=1&pageSize=1', { headers }));
      const item = (list.items as { id: string }[] | undefined)?.[0];
      if (!item) return { status: 0, photoUrl: '' };
      const bytes = Uint8Array.from(atob(pngBase64), (char) => char.charCodeAt(0));
      const body = new FormData();
      body.append('file', new File([bytes], 'photo.png', { type: 'image/png' }));
      const response = await fetch(`/api/v1/menu/items/${item.id}/photo`, { method: 'POST', headers, body });
      const result = await json(response);
      return { status: response.status, photoUrl: typeof result.photoUrl === 'string' ? result.photoUrl : '' };
    }, png);
    expect(uploaded.status, JSON.stringify(uploaded)).toBe(200);
    // The API answers with a path on its own origin; in the shell that origin is the gateway.
    expect(uploaded.photoUrl).toMatch(/^\/files\//);

    await web.goto(gatewayUrl('/admin/menu'));
    const photo = web.locator(`img[src="${gatewayUrl(uploaded.photoUrl)}"]`).first();
    await photo.waitFor();
    await expect.poll(() => photo.evaluate((image) => (image as HTMLImageElement).naturalWidth), { timeout: 10_000 }).toBeGreaterThan(0);
    expect(monitor.errors).toEqual([]);
    expect(monitor.failedRequests).toEqual([]);
  });

  it('blocks window.open and navigation away from the gateway origin', async () => {
    // Web links are handed to the system browser; recorded here instead of really opening one.
    await app.evaluate(({ shell }) => {
      const opened: string[] = [];
      (globalThis as { e2eOpenedExternally?: string[] }).e2eOpenedExternally = opened;
      shell.openExternal = (url: string) => {
        opened.push(url);
        return Promise.resolve();
      };
    });
    const openedExternally = (): Promise<string[]> =>
      app.evaluate(() => (globalThis as { e2eOpenedExternally?: string[] }).e2eOpenedExternally ?? []);

    expect(await web.evaluate(() => window.open('https://example.com/docs') === null)).toBe(true);
    expect(await web.evaluate(() => window.open('file:///C:/Windows/win.ini') === null)).toBe(true);
    // A link to the app itself opens neither a second window nor a browser tab on the loopback gateway.
    expect(await web.evaluate(() => window.open('/admin') === null)).toBe(true);
    expect(await web.evaluate(() => window.open(`http://localhost:${window.location.port}/admin`) === null)).toBe(true);
    await expect.poll(openedExternally).toEqual(['https://example.com/docs']);
    await web.waitForTimeout(300);
    expect(await openedExternally()).toEqual(['https://example.com/docs']);
    expect(app.windows()).toHaveLength(1);

    const before = web.url();
    await web.evaluate(() => {
      window.location.href = 'https://example.invalid/';
    });
    await web.waitForTimeout(500);
    expect(web.url()).toBe(before);
    // The page is still the running web app (it was not unloaded for the blocked navigation).
    expect(await web.getByRole('button', { name: 'Меню пользователя' }).count()).toBe(1);
  });

  it('keeps settings and the session when the app is quit and started again', async () => {
    const before = await savedSettings();
    await app.close();

    await launch();
    web = await webAppWindow(app);
    monitor = monitorPage(web);
    // Straight to the web app: no connection window, no sign-in form — the refresh cookie was kept on disk.
    await web.waitForSelector('h1');
    expect(app.windows()).toHaveLength(1);
    expect(web.url()).toBe(gatewayUrl('/admin'));
    expect(await heading()).toBe('Дашборд');
    expect(await web.locator('input[type="password"]').count()).toBe(0);
    expect(await savedSettings()).toMatchObject({ serverUrl: before.serverUrl, printer: before.printer, silentPrint: before.silentPrint });
    // Same gateway port → same origin → the web app's own storage (current branch) is still there.
    expect(await web.evaluate(() => localStorage.getItem('respos.branchId'))).toBeTruthy();
  });

  it('server down: the web app says so instead of going blank, and carries on when the server is back', async () => {
    await web.goto(gatewayUrl('/waiter'));
    const indicator = web.locator(REALTIME_INDICATOR);
    await web.locator(`${REALTIME_INDICATOR}[title="${ONLINE}"]`).waitFor();

    await relay.stop();
    // The page stays on screen; its indicator leaves "online".
    await expect.poll(() => indicator.getAttribute('title'), { timeout: 30_000 }).not.toBe(ONLINE);
    expect(await heading()).toBe('Зал');

    // Reloading during the outage still shows the app (served locally) with its "no connection" message.
    await web.reload();
    await web.getByText('Нет связи с сервером').first().waitFor({ timeout: 20_000 });
    expect(web.url()).toBe(gatewayUrl('/waiter'));
    // The gateway answers API calls with its own ProblemDetails, never with a dropped connection.
    const probe = await web.evaluate(async () => {
      const response = await fetch('/api/v1/auth/me');
      return { status: response.status, body: (await response.json()) as unknown };
    });
    expect(probe).toEqual({ status: 502, body: { status: 502, code: 'desktop.server_unreachable', title: 'Server unreachable' } });

    await relay.start();
    // Either the session restore that is still retrying succeeds, or it has given up and shows the sign-in
    // form; in that case a reload restores the session from the cookie.
    const online = web.locator(`${REALTIME_INDICATOR}[title="${ONLINE}"]`);
    const signIn = web.locator('input[type="password"]');
    await online.or(signIn).first().waitFor({ timeout: 30_000 });
    if ((await signIn.count()) > 0) {
      await web.reload();
      await online.waitFor({ timeout: 30_000 });
    }
    expect(web.url()).toBe(gatewayUrl('/waiter'));
    expect(await heading()).toBe('Зал');
  });

  it('server down at start: the connection window waits for it and the app continues signed in', async () => {
    await app.close();
    await relay.stop();

    await launch();
    const settings = await settingsWindow(app);
    expect(app.windows()).toHaveLength(1);
    expect(await settings.locator('#reason').textContent()).toContain('Сервер недоступен');
    expect(await settings.inputValue('#server-url')).toBe(relay.origin);

    await relay.start();
    web = await webAppWindow(app, 30_000);
    await waitUntilClosed(app, isSettingsPage);
    await web.waitForSelector('h1');
    expect(await heading()).toBe('Дашборд');
    expect(await web.locator('input[type="password"]').count()).toBe(0);
  });
});
