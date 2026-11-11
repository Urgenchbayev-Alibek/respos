import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ElectronApplication } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { closedPort, type FakeUpstream, startFakeUpstream } from '../tests/helpers/fake-upstream';
import {
  APP_DIR,
  clickClosing,
  isSettingsPage,
  launchApp,
  runSecondInstance,
  settingsWindow,
  waitUntilClosed,
  webAppWindow,
} from './helpers/launch';

/**
 * Shell smoke test: the real app (development build) against a fake backend. Needs no RestaurantOS server and
 * no built web app — without `web-dist/` the gateway serves its placeholder page, which is enough to check
 * the windows, the bridge, the proxy path and the security rules. It passes with a built `web-dist/` as well
 * (the web app then shows its sign-in page: the fake backend has no session to restore).
 */

let upstream: FakeUpstream;
let workDir: string;
const running: ElectronApplication[] = [];

async function start(userData: string, args: string[] = []): Promise<ElectronApplication> {
  const app = await launchApp(userData, { args });
  running.push(app);
  return app;
}

async function profile(name: string, settings?: Record<string, unknown>): Promise<string> {
  const directory = path.join(workDir, name);
  await mkdir(directory, { recursive: true });
  if (settings) await writeFile(path.join(directory, 'settings.json'), JSON.stringify(settings));
  return directory;
}

async function savedSettings(userData: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(userData, 'settings.json'), 'utf8')) as Record<string, unknown>;
}

beforeAll(async () => {
  upstream = await startFakeUpstream();
  workDir = await mkdtemp(path.join(tmpdir(), 'respos-desktop-e2e-'));
});

afterEach(async () => {
  for (const app of running.splice(0)) await app.close().catch(() => undefined);
});

afterAll(async () => {
  await upstream.close();
  await rm(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

describe('first run', () => {
  it('shows the connection window, checks the server, saves and opens the web app', async () => {
    const userData = await profile('first-run');
    const app = await start(userData);

    const settings = await settingsWindow(app);
    expect(app.windows()).toHaveLength(1);
    expect(await settings.locator('h1').textContent()).toBe('Настройки подключения');
    expect(await settings.locator('#reason').textContent()).toContain('Укажите адрес сервера');
    expect(await settings.evaluate(() => document.documentElement.lang)).toBe('ru');

    // The page gets its own bridge only; nothing of Node or of the web app's bridge leaks into it.
    expect(
      await settings.evaluate(() => ({
        bridge: Object.keys((window as { resposSettings?: object }).resposSettings ?? {}).sort(),
        desktop: 'resposDesktop' in window,
        node: typeof (window as { require?: unknown }).require + typeof (window as { process?: unknown }).process,
      })),
    ).toEqual({ bridge: ['close', 'getState', 'listPrinters', 'save', 'testConnection'], desktop: false, node: 'undefinedundefined' });

    // RU / UZ / EN
    await settings.click('button[data-language="en"]');
    expect(await settings.locator('h1').textContent()).toBe('Connection settings');
    await settings.click('button[data-language="uz"]');
    expect(await settings.locator('h1').textContent()).toBe('Ulanish sozlamalari');
    expect(await settings.locator('#save-button').textContent()).toBe('Saqlash');
    await settings.click('button[data-language="ru"]');

    // Saving without an address is refused by main, nothing is written.
    await settings.click('#save-button');
    await settings.waitForSelector('#form-error:not([hidden])');
    expect(await settings.locator('#form-error').textContent()).toBe('Введите адрес сервера.');

    // «Проверить соединение»: a dead address, then the fake backend (scheme is added for the user).
    await settings.fill('#server-url', `127.0.0.1:${await closedPort()}`);
    await settings.click('#test-button');
    await settings.waitForSelector('#test-status[data-kind="error"]');
    expect(await settings.locator('#test-status').textContent()).toContain('Сервер недоступен');

    await settings.fill('#server-url', `127.0.0.1:${upstream.port}`);
    await settings.click('#test-button');
    await settings.waitForSelector('#test-status[data-kind="ok"]');
    expect(await settings.locator('#test-status').textContent()).toBe('Соединение установлено');
    expect(await settings.inputValue('#server-url')).toBe(upstream.origin);

    await settings.check('#kiosk');
    await settings.uncheck('#kiosk');
    await clickClosing(settings, '#save-button');

    const web = await webAppWindow(app);
    await waitUntilClosed(app, isSettingsPage);
    expect(app.windows()).toHaveLength(1);
    expect(await savedSettings(userData)).toMatchObject({ serverUrl: upstream.origin, language: 'ru', kiosk: false, silentPrint: false });

    // The contract, and nothing else, is exposed to the web app.
    const version = (JSON.parse(await readFile(path.join(APP_DIR, 'package.json'), 'utf8')) as { version: string }).version;
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

    // Same-origin API through the gateway: proxied request, cookie stored for the loopback origin, WebSocket hub.
    expect(await web.evaluate(async () => (await fetch('/health/ready')).text())).toBe('Healthy');
    expect(await web.evaluate(async () => (await fetch('/api/v1/auth/login', { method: 'POST', body: '{}' })).status)).toBe(200);
    const cookies = await app.evaluate(({ session }) => session.defaultSession.cookies.get({ name: 'refresh_token' }));
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({ domain: '127.0.0.1', path: '/api/v1/auth', httpOnly: true, secure: false, sameSite: 'lax' });
    expect(await web.evaluate(() => document.cookie)).toBe('');
    // Cookies travel back by their own Path: /api/v1 gets the device cookie, not the refresh cookie.
    const echoed = await web.evaluate(
      async () => (await (await fetch('/api/v1/echo', { method: 'POST', body: '{}' })).json()) as { headers: Record<string, string> },
    );
    expect(echoed.headers.cookie).toBe('device_token=xyz');
    expect(echoed.headers.origin).toBeUndefined();
    expect(echoed.headers.host).toBe(`127.0.0.1:${upstream.port}`);

    const frame = await web.evaluate(
      () =>
        new Promise<string>((resolve, reject) => {
          const socket = new WebSocket(`ws://${window.location.host}/hubs/restaurant`);
          socket.onopen = () => socket.send('{"protocol":"json","version":1}');
          socket.onmessage = (event) => resolve(String(event.data));
          socket.onerror = () => reject(new Error('websocket failed'));
        }),
    );
    expect(frame).toBe('{"protocol":"json","version":1}');
  });
});

describe('configured app', () => {
  it('opens the web app directly, with the Russian menu and locked-down navigation', async () => {
    const userData = await profile('configured', { serverUrl: upstream.origin });
    const app = await start(userData);
    const web = await webAppWindow(app);
    expect(app.windows()).toHaveLength(1);

    const menu = await app.evaluate(({ Menu }) =>
      (Menu.getApplicationMenu()?.items ?? []).map((item) => ({
        label: item.label,
        items: (item.submenu?.items ?? []).filter((entry) => entry.type !== 'separator').map((entry) => entry.label),
      })),
    );
    expect(menu).toEqual([
      { label: 'Файл', items: ['Настройки подключения', 'Перезагрузить', 'Выход'] },
      { label: 'Вид', items: ['Во весь экран', 'Масштаб', 'Инструменты разработчика'] },
      { label: 'Справка', items: ['О программе'] },
    ]);

    const preferences = await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      // Not part of the public typings, but the only way to read the effective preferences of a live window.
      const contents = window?.webContents as unknown as { getLastWebPreferences(): Record<string, unknown> | null } | undefined;
      const prefs = contents?.getLastWebPreferences();
      return {
        contextIsolation: prefs?.contextIsolation,
        sandbox: prefs?.sandbox,
        nodeIntegration: prefs?.nodeIntegration,
        webSecurity: prefs?.webSecurity,
        webviewTag: prefs?.webviewTag,
        kiosk: window?.isKiosk(),
      };
    });
    expect(preferences).toEqual({
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: false,
      kiosk: false,
    });

    // window.open is denied (a non-web URL: nothing is handed to the system browser during the test).
    expect(await web.evaluate(() => window.open('about:blank') === null)).toBe(true);
    // Navigation away from the gateway origin is blocked. (Only the origin is compared: with a built web app
    // in web-dist/ the page moves to its own /login route in the meantime.)
    const origin = new URL(web.url()).origin;
    await web.evaluate(() => {
      window.location.href = 'https://example.invalid/';
    });
    await web.waitForTimeout(500);
    expect(new URL(web.url()).origin).toBe(origin);
    expect(app.windows()).toHaveLength(1);

    // A second copy on the same profile exits at once; the running one stays.
    expect(await runSecondInstance(userData)).toBe(0);
    expect(app.windows()).toHaveLength(1);

    // The bridge opens the connection window (reason "manual": no banner); Cancel closes it again.
    await web.evaluate(() => (window as unknown as { resposDesktop: { openConnectionSettings(): Promise<void> } }).resposDesktop.openConnectionSettings());
    const settings = await settingsWindow(app);
    expect(await settings.locator('#reason').isHidden()).toBe(true);
    expect(await settings.inputValue('#server-url')).toBe(upstream.origin);
    expect(await settings.locator('#app-version').textContent()).toMatch(/^\d+\.\d+\.\d+/);
    await clickClosing(settings, '#cancel-button');
    await waitUntilClosed(app, isSettingsPage);
    expect(app.windows()).toHaveLength(1);
  });

  it('reports a missing receipt printer so the web app can fall back to the dialog', async () => {
    const userData = await profile('printer', { serverUrl: upstream.origin, printer: 'No Such Printer 80', silentPrint: true });
    const app = await start(userData);
    const web = await webAppWindow(app);
    const result = await web.evaluate(() =>
      (window as unknown as { resposDesktop: { print(options: { paper: string }): Promise<unknown> } }).resposDesktop.print({
        paper: 'receipt-80mm',
      }),
    );
    expect(result).toEqual({ ok: false, reason: 'printer_not_found' });

    // The connection window lists the stored printer as missing instead of silently dropping it.
    await web.evaluate(() => (window as unknown as { resposDesktop: { openConnectionSettings(): Promise<void> } }).resposDesktop.openConnectionSettings());
    const settings = await settingsWindow(app);
    expect(await settings.inputValue('#printer')).toBe('No Such Printer 80');
    expect(await settings.isChecked('#silent-print')).toBe(true);
  });

  it('remembers the window bounds and does not let them creep between launches', async () => {
    // Windows rounds sizes with fractional display scaling, hence the few pixels of tolerance.
    const near = (actual: number | undefined, expected: number): boolean => actual !== undefined && Math.abs(actual - expected) <= 8;
    const bounds = (app: ElectronApplication) => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getBounds());
    const stored = { x: 80, y: 60, width: 1000, height: 700, maximized: false };
    const userData = await profile('bounds', { serverUrl: upstream.origin, windowBounds: stored });
    // The window as a user gets it: on screen (it is shown only after the first paint), and with any
    // system-made size change behind it (the shell saves bounds half a second after the last change).
    const onScreen = async (running: ElectronApplication): Promise<void> => {
      await webAppWindow(running);
      const visible = (): Promise<boolean | undefined> => running.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible());
      await expect.poll(visible, { timeout: 15_000 }).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 800));
    };

    let app = await start(userData);
    await onScreen(app);
    const restored = await bounds(app);
    expect(restored).toMatchObject({ x: 80, y: 60 });
    expect(near(restored?.width, 1000) && near(restored?.height, 700), JSON.stringify(restored)).toBe(true);
    await app.close();
    // Nothing was moved or resized: the stored value is left exactly as it was.
    expect((await savedSettings(userData)).windowBounds).toEqual(stored);

    app = await start(userData);
    await onScreen(app);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setBounds({ x: 120, y: 90, width: 1100, height: 720 }));
    await app.close();
    const saved = (await savedSettings(userData)).windowBounds as { x: number; y: number; width: number; height: number; maximized: boolean };
    expect(saved).toMatchObject({ x: 120, y: 90, maximized: false });
    expect(near(saved.width, 1100) && near(saved.height, 720), JSON.stringify(saved)).toBe(true);

    app = await start(userData);
    await onScreen(app);
    const reopened = await bounds(app);
    expect(near(reopened?.width, saved.width) && near(reopened?.height, saved.height), JSON.stringify(reopened)).toBe(true);
    await app.close();
    expect((await savedSettings(userData)).windowBounds).toEqual(saved);
  });
});

describe('server down at startup', () => {
  it('shows the connection window and continues by itself once the server answers', async () => {
    const port = await closedPort();
    const userData = await profile('unreachable', { serverUrl: `http://127.0.0.1:${port}`, language: 'en' });
    const app = await start(userData);

    const settings = await settingsWindow(app);
    expect(app.windows()).toHaveLength(1);
    expect(await settings.locator('h1').textContent()).toBe('Connection settings');
    expect(await settings.locator('#reason').textContent()).toContain('The server is not reachable');
    expect(await settings.inputValue('#server-url')).toBe(`http://127.0.0.1:${port}`);

    const revived = await startFakeUpstream(port);
    try {
      const web = await webAppWindow(app, 30_000);
      await waitUntilClosed(app, isSettingsPage);
      expect(await web.evaluate(async () => (await fetch('/health/ready')).status)).toBe(200);
    } finally {
      await app.close();
      running.length = 0;
      await revived.close();
    }
  });
});

describe('kiosk mode', () => {
  it('starts full screen with --kiosk and leaves kiosk mode on Ctrl+Shift+Q', async () => {
    const userData = await profile('kiosk', { serverUrl: upstream.origin });
    const app = await start(userData, ['--kiosk']);
    const web = await webAppWindow(app);

    const state = () =>
      app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        return { kiosk: window?.isKiosk(), menuBar: window?.isMenuBarVisible() };
      });
    expect(await state()).toEqual({ kiosk: true, menuBar: false });

    // A real key press (through the OS input path, as from a keyboard); `code` is what the shell looks at.
    expect(web.url()).toMatch(/^http:\/\/127\.0\.0\.1:/);
    await app.evaluate(({ BrowserWindow }) => {
      const contents = BrowserWindow.getAllWindows()[0]?.webContents;
      contents?.sendInputEvent({ type: 'keyDown', keyCode: 'Q', modifiers: ['control', 'shift'] });
      contents?.sendInputEvent({ type: 'keyUp', keyCode: 'Q', modifiers: ['control', 'shift'] });
    });
    await expect.poll(state, { timeout: 10_000 }).toEqual({ kiosk: false, menuBar: true });
    // The stored setting is untouched: the next start is a kiosk again only if asked for.
    expect((await savedSettings(userData)).kiosk).not.toBe(true);
  });

  it('exits completely when closed in kiosk mode, so the next start is not blocked by a stale instance', async () => {
    const userData = await profile('kiosk-quit', { serverUrl: upstream.origin, kiosk: true });
    const app = await start(userData);
    await webAppWindow(app);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isKiosk())).toBe(true);

    const child = app.process();
    const exited = new Promise<boolean>((resolve) => {
      child.once('exit', () => resolve(true));
      setTimeout(() => resolve(false), 20_000);
    });
    await app.evaluate(({ app: electronApp }) => electronApp.quit());
    expect(await exited).toBe(true);
    running.length = 0;

    // The single-instance lock is free again: a new start shows its window.
    const again = await start(userData);
    await webAppWindow(again);
    expect(again.windows()).toHaveLength(1);
  });
});
