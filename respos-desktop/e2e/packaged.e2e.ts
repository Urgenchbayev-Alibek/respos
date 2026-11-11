import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Page } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { type FakeUpstream, startFakeUpstream } from '../tests/helpers/fake-upstream';
import { APP_DIR, clickClosing, freeGatewayPort, isSettingsPage, isWebAppPage } from './helpers/launch';
import { launchPackagedApp, type PackagedApp, runSecondPackagedInstance } from './helpers/packaged';

/**
 * Smoke test of the PACKAGED app — the exe electron-builder produced, with its fuses flipped, its code in
 * app.asar and the web app in resources/web-dist. Run it through `npm run e2e:packaged` after `npm run pack`
 * (or `npm run dist`); the script passes the exe as RESPOS_E2E_PACKAGED_EXE. With RESPOS_E2E_SERVER_URL the
 * sign-in scenario against a real backend runs too (one password login, demo waiter).
 */
const executable = process.env.RESPOS_E2E_PACKAGED_EXE;
const serverUrl = process.env.RESPOS_E2E_SERVER_URL;
const email = process.env.RESPOS_E2E_PACKAGED_EMAIL ?? 'waiter@demo.respos.uz';
const password = process.env.RESPOS_E2E_PASSWORD ?? 'Demo123!';

const ONLINE_INDICATOR = '[role="status"][title="Онлайн"]';
/** The portable exe unpacks ~300 MB into the temp folder on every start (three starts in one scenario). */
const SCENARIO_TIMEOUT_MS = 300_000;

describe.skipIf(!executable)('packaged app', () => {
  let upstream: FakeUpstream;
  let workDir: string;
  let version: string;
  const running: PackagedApp[] = [];

  const start = async (userData: string, gatewayPort: number, printCaptureFile?: string): Promise<PackagedApp> => {
    const app = await launchPackagedApp(executable ?? '', userData, { gatewayPort, printCaptureFile });
    running.push(app);
    return app;
  };
  const mainLog = (userData: string): Promise<string> => readFile(path.join(userData, 'logs', 'main.log'), 'utf8');
  const heading = (page: Page): Promise<string | null> => page.locator('h1').first().textContent();

  beforeAll(async () => {
    upstream = await startFakeUpstream();
    workDir = await mkdtemp(path.join(tmpdir(), 'respos-desktop-packaged-'));
    version = (JSON.parse(await readFile(path.join(APP_DIR, 'package.json'), 'utf8')) as { version: string }).version;
  });

  afterEach(() => {
    for (const app of running.splice(0)) app.kill();
  });

  afterAll(async () => {
    await upstream.close();
    await rm(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  it('starts from the packaged layout: connection window, bundled web app, bridge, print, clean exit', async () => {
    const userData = path.join(workDir, 'first-run');
    const printCaptureFile = path.join(workDir, 'print-jobs.jsonl');
    await mkdir(userData);
    const gatewayPort = await freeGatewayPort();
    // The helper starts the exe with ELECTRON_RUN_AS_NODE=1: it only comes up because the RunAsNode fuse is off.
    const app = await start(userData, gatewayPort, printCaptureFile);

    // Connection window: page, stylesheet, script and its preload all come out of app.asar.
    const settings = await app.page(isSettingsPage);
    await settings.waitForSelector('#fields:not([disabled])');
    expect(await heading(settings)).toBe('Настройки подключения');
    expect(await settings.locator('#app-version').textContent()).toBe(version);
    expect(await settings.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Segoe UI');

    await settings.fill('#server-url', upstream.origin);
    await settings.click('#test-button');
    await settings.waitForSelector('#test-status[data-kind="ok"]');
    await clickClosing(settings, '#save-button');

    // Main window: the real web app out of resources/web-dist, served by the gateway.
    const web = await app.page(isWebAppPage);
    await web.waitForSelector('input[type="email"]');
    expect(web.url()).toBe(`http://127.0.0.1:${gatewayPort}/login`);
    expect(await heading(web)).toBe('Вход в RestaurantOS');
    expect(await web.locator('[data-testid="desktop-placeholder"]').count()).toBe(0);
    expect(await web.evaluate(() => document.querySelectorAll('script[src^="/assets/"]').length)).toBeGreaterThan(0);

    // The app preload: exactly the contract, with the version of the packaged app.
    expect(
      await web.evaluate(() => {
        const bridge = (window as { resposDesktop?: Record<string, unknown> }).resposDesktop ?? {};
        return {
          keys: Object.keys(bridge).sort(),
          isDesktop: bridge.isDesktop,
          appVersion: bridge.appVersion,
          settingsBridge: 'resposSettings' in window,
          node: typeof (window as { require?: unknown }).require + typeof (window as { process?: unknown }).process,
        };
      }),
    ).toEqual({
      keys: ['appVersion', 'isDesktop', 'openConnectionSettings', 'print'],
      isDesktop: true,
      appVersion: version,
      settingsBridge: false,
      node: 'undefinedundefined',
    });

    // Proxy and IPC in the packaged build.
    expect(await web.evaluate(async () => (await fetch('/health/ready')).text())).toBe('Healthy');
    const printed = await web.evaluate(() =>
      (window as unknown as { resposDesktop: { print(options: { paper: string }): Promise<unknown> } }).resposDesktop.print({ paper: 'a4' }),
    );
    expect(printed).toEqual({ ok: true });
    const jobs = (await readFile(printCaptureFile, 'utf8')).trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(jobs).toEqual([expect.objectContaining({ paper: 'a4', silent: false, pageSize: 'A4', page: '/login' })]);

    // A second start (another double click on the shortcut or on the portable exe) exits by itself and
    // leaves the running app intact: its files are still there when the page is loaded again.
    expect(await runSecondPackagedInstance(executable ?? '', userData, { gatewayPort })).toBe(0);
    expect(app.pages()).toHaveLength(1);
    await web.reload();
    await web.waitForSelector('input[type="email"]');
    expect(await web.locator('[data-testid="desktop-placeholder"]').count()).toBe(0);

    expect(JSON.parse(await readFile(path.join(userData, 'settings.json'), 'utf8'))).toMatchObject({ serverUrl: upstream.origin });
    expect(await app.quit()).toBe(0);
    running.length = 0;

    const log = await mainLog(userData);
    expect(log).toContain(`RestaurantOS desktop ${version} starting`);
    expect(log).toContain(`gateway listening on http://127.0.0.1:${gatewayPort}`);
    expect(log).not.toMatch(/ ERROR /);
  }, SCENARIO_TIMEOUT_MS);

  it.skipIf(!serverUrl)('signs in against the real backend and keeps the session over a restart', async () => {
    const userData = path.join(workDir, 'real-backend');
    await mkdir(userData);
    await writeFile(path.join(userData, 'settings.json'), JSON.stringify({ serverUrl }));
    const gatewayPort = await freeGatewayPort();

    let app = await start(userData, gatewayPort);
    let web = await app.page(isWebAppPage);
    await web.waitForSelector('input[type="email"]');
    await web.fill('input[type="email"]', email);
    await web.fill('input[type="password"]', password);
    await web.click('button[type="submit"]');
    await web.waitForURL(`http://127.0.0.1:${gatewayPort}/waiter`);
    // Data from the API and the SignalR connection, both through the gateway of the packaged app.
    await web.locator(ONLINE_INDICATOR).waitFor();
    expect(await heading(web)).toBe('Зал');
    expect(await app.quit()).toBe(0);
    running.length = 0;

    // Second start on the same profile: the refresh cookie (encrypted on disk, cookie-encryption fuse) is
    // still valid, so the user is not asked to sign in again.
    app = await start(userData, gatewayPort);
    web = await app.page(isWebAppPage);
    await web.locator(ONLINE_INDICATOR).waitFor();
    expect(web.url()).toBe(`http://127.0.0.1:${gatewayPort}/waiter`);
    expect(await heading(web)).toBe('Зал');
    expect(await web.locator('input[type="password"]').count()).toBe(0);
    expect(await app.quit()).toBe(0);
    running.length = 0;
    expect(await mainLog(userData)).not.toMatch(/ ERROR /);
  }, SCENARIO_TIMEOUT_MS);
});
