import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { freeGatewayPort, isSettingsPage, isWebAppPage, settingsWindow, waitUntilClosed, webAppWindow } from '../helpers/launch';
import { ACCOUNTS, DEMO_PASSWORD, SCENARIO_DIR, SERVER_URL, loginWithPassword, startApp, type StartedApp } from './helpers/scenario';

/** Visible strings of the connection window, per shell language (src/settings-ui/i18n.ts). */
const UI = {
  ru: { button: 'Русский', title: 'Настройки подключения', address: 'Адрес сервера', test: 'Проверить соединение', ok: 'Соединение установлено', save: 'Сохранить', cancel: 'Отмена', firstRun: 'Укажите адрес сервера RestaurantOS, чтобы начать работу.', unreachable: 'Сервер недоступен. Проверьте адрес и подключение к сети.', fileMenu: 'Файл' },
  uz: { button: 'O‘zbekcha', title: 'Ulanish sozlamalari', address: 'Server manzili', test: 'Ulanishni tekshirish', ok: 'Ulanish o‘rnatildi', save: 'Saqlash', cancel: 'Bekor qilish', firstRun: 'Ishni boshlash uchun RestaurantOS server manzilini kiriting.', unreachable: 'Server javob bermayapti. Manzil va tarmoq ulanishini tekshiring.', fileMenu: 'Fayl' },
  en: { button: 'English', title: 'Connection settings', address: 'Server address', test: 'Test connection', ok: 'Connection established', save: 'Save', cancel: 'Cancel', firstRun: 'Enter the address of your RestaurantOS server to get started.', unreachable: 'The server is not reachable. Check the address and the network connection.', fileMenu: 'File' },
} as const;
type Lang = keyof typeof UI;

/** DESIGN.md: settings.json holds serverUrl, printer, silentPrint, kiosk, autoStart, language, windowBounds — nothing else. */
const DOCUMENTED_FIELDS = ['autoStart', 'kiosk', 'language', 'printer', 'serverUrl', 'silentPrint', 'windowBounds'];
const LOGIN_FORM = 'Вход в RestaurantOS';
const WAIT = { timeout: 60_000 };

describe('first-run: first start and connection settings', () => {
  const profile = `first-run-${Date.now()}`;
  let gatewayPort = 0;
  let deadUrl = '';
  /** The same backend under its other loopback name: a different server address as far as the shell knows. */
  const otherUrl = SERVER_URL.includes('127.0.0.1') ? SERVER_URL.replace('127.0.0.1', 'localhost') : SERVER_URL.replace('localhost', '127.0.0.1');
  let started: StartedApp;
  let app: ElectronApplication;
  let connection: Page;
  let web: Page;

  const settingsFile = (): string => path.join(started.userDataDir, 'settings.json');
  const savedSettings = async (): Promise<Record<string, unknown>> =>
    JSON.parse(await readFile(settingsFile(), 'utf8')) as Record<string, unknown>;
  const shot = (page: Page, name: string): Promise<unknown> =>
    page.screenshot({ path: path.join(SCENARIO_DIR, `${name}.png`) }).catch(() => undefined);
  const cookieNames = (): Promise<string[]> =>
    app.evaluate(async ({ session }) => (await session.defaultSession.cookies.get({})).map((cookie) => cookie.name));
  /** Application menu → first item of the first menu («Файл → Настройки подключения»); returns both labels. */
  const clickConnectionMenuItem = (): Promise<{ menu: string; item: string }> =>
    app.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu()?.items[0];
      const item = menu?.submenu?.items[0];
      item?.click();
      return { menu: menu?.label ?? '', item: item?.label ?? '' };
    });
  /** Waits until main has really dropped the previous connection window (see the note in the report), then uses the menu. */
  const openFromMenu = async (): Promise<Page> => {
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), WAIT).toBe(1);
    await clickConnectionMenuItem();
    return settingsWindow(app);
  };
  const testAddress = async (page: Page, lang: Lang, address: string): Promise<void> => {
    await page.getByLabel(UI[lang].address).fill(address);
    await page.getByRole('button', { name: UI[lang].test }).click();
  };
  /** Save closes its own window: the click may be cut short by that, which is the expected outcome. */
  const clickSave = async (page: Page, lang: Lang): Promise<void> => {
    try {
      await page.getByRole('button', { name: UI[lang].save }).click();
    } catch (error) {
      if (!page.isClosed()) throw error;
    }
  };

  beforeAll(async () => {
    gatewayPort = await freeGatewayPort();
    deadUrl = `http://127.0.0.1:${await freeGatewayPort()}`;
    started = await startApp({ profile, configured: false, gatewayPort });
    if (!started.app) throw new Error('The development build exposes the Electron handle');
    app = started.app;
    connection = started.page;
  });

  afterAll(async () => {
    await started?.close();
  });

  it('a fresh profile shows the connection window, not the app', async () => {
    expect(existsSync(settingsFile())).toBe(false);
    expect(app.windows().filter(isSettingsPage)).toHaveLength(1);
    expect(app.windows().filter(isWebAppPage)).toHaveLength(0);
    await connection.getByRole('heading', { level: 1, name: UI.ru.title }).waitFor(WAIT);
    await connection.getByText(UI.ru.firstRun).waitFor(WAIT);
    expect(await connection.getByLabel(UI.ru.address).inputValue()).toBe('');
    await shot(connection, '01-first-run');
  });

  it('rejects an invalid address with a clear message and saves nothing', async () => {
    await testAddress(connection, 'ru', 'ftp://example.com');
    await connection.getByText('Адрес должен начинаться с http:// или https://.').waitFor(WAIT);
    await testAddress(connection, 'ru', 'http://admin:secret@192.168.1.10:5080');
    await connection.getByText('Не указывайте логин и пароль в адресе сервера.').waitFor(WAIT);
    await testAddress(connection, 'ru', 'http://exa mple');
    await connection.getByText('Адрес сервера указан неверно.').waitFor(WAIT);

    // Save with an empty and with a bad address: an alert, the window stays, nothing is written.
    await connection.getByLabel(UI.ru.address).fill('');
    await clickSave(connection, 'ru');
    await expect.poll(() => connection.getByRole('alert').textContent(), WAIT).toBe('Введите адрес сервера.');
    await connection.getByLabel(UI.ru.address).fill('ftp://example.com');
    await clickSave(connection, 'ru');
    await expect.poll(() => connection.getByRole('alert').textContent(), WAIT).toBe('Адрес должен начинаться с http:// или https://.');
    await shot(connection, '02-invalid');
    expect(connection.isClosed()).toBe(false);
    expect(existsSync(settingsFile())).toBe(false);
    expect(app.windows().filter(isWebAppPage)).toHaveLength(0);
  });

  it('shows a clear error for an unreachable address after "test connection"', async () => {
    await testAddress(connection, 'ru', deadUrl);
    await connection.getByText(UI.ru.unreachable).waitFor(WAIT);
    await shot(connection, '03-unreachable');
    expect(existsSync(settingsFile())).toBe(false);
  });

  it('switches the language of the connection window (RU / UZ / EN)', async () => {
    for (const lang of ['uz', 'en', 'ru', 'uz'] as const) {
      await connection.getByRole('button', { name: UI[lang].button }).click();
      await connection.getByRole('heading', { level: 1, name: UI[lang].title }).waitFor(WAIT);
      await connection.getByText(UI[lang].firstRun).waitFor(WAIT);
      // The result of the last test is re-rendered in the new language.
      await connection.getByText(UI[lang].unreachable).waitFor(WAIT);
      expect(await connection.getByRole('button', { name: UI[lang].button }).getAttribute('aria-pressed')).toBe('true');
      expect(await connection.title()).toBe(`RestaurantOS — ${UI[lang].title}`);
    }
    await shot(connection, '04-uzbek');
  });

  it('the right address tests OK and saving opens the app at its login page', async () => {
    // Typed without a scheme and with a path: the window shows the address the way it will be stored.
    await testAddress(connection, 'uz', `${SERVER_URL.replace('http://', '')}/api/v1`);
    await connection.getByText(UI.uz.ok).waitFor(WAIT);
    expect(await connection.getByLabel(UI.uz.address).inputValue()).toBe(SERVER_URL);
    await clickSave(connection, 'uz');

    web = await webAppWindow(app, 90_000);
    await waitUntilClosed(app, isSettingsPage, 30_000);
    await web.getByRole('form', { name: LOGIN_FORM }).waitFor(WAIT);
    expect(new URL(web.url()).pathname).toMatch(/^\/login/);
    expect(new URL(web.url()).port).toBe(String(gatewayPort));
    expect(await savedSettings()).toMatchObject({ serverUrl: SERVER_URL, language: 'uz' });
    await shot(web, '05-login');
  });

  it('reopens from the application menu after login, in the saved language, and keeps the session on save', async () => {
    await loginWithPassword(web, ACCOUNTS.admin);
    const signedInUrl = web.url();
    await web.evaluate(() => localStorage.setItem('scenario-marker', 'kept'));
    expect(await cookieNames()).not.toEqual([]);

    // The language chosen on first run persisted: the menu and the reopened window are Uzbek.
    expect(await clickConnectionMenuItem()).toEqual({ menu: UI.uz.fileMenu, item: UI.uz.title });
    const reopened = await settingsWindow(app);
    await reopened.getByRole('heading', { level: 1, name: UI.uz.title }).waitFor(WAIT);
    expect(await reopened.getByLabel(UI.uz.address).inputValue()).toBe(SERVER_URL);
    // Opened by hand: no first-run banner.
    expect(await reopened.getByText(UI.uz.firstRun).count()).toBe(0);

    await reopened.getByRole('button', { name: UI.ru.button }).click();
    await clickSave(reopened, 'ru');
    await waitUntilClosed(app, isSettingsPage, 30_000);
    await expect.poll(async () => (await savedSettings()).language, WAIT).toBe('ru');
    const labels = await app.evaluate(({ Menu }) => Menu.getApplicationMenu()?.items[0]?.label ?? '');
    expect(labels).toBe(UI.ru.fileMenu);
    // Same server: the web app was not reloaded, the user is still signed in.
    expect(web.url()).toBe(signedInUrl);
    expect(await web.evaluate(() => localStorage.getItem('scenario-marker'))).toBe('kept');
  });

  it('reopens from the web app user menu (window.resposDesktop.openConnectionSettings)', async () => {
    expect(await web.evaluate(() => typeof (window as unknown as { resposDesktop?: { openConnectionSettings?: unknown } }).resposDesktop?.openConnectionSettings)).toBe('function');
    await web.getByRole('button', { name: 'Меню пользователя' }).click();
    await web.getByRole('menuitem', { name: UI.ru.title }).click();
    const reopened = await settingsWindow(app);
    await reopened.getByRole('heading', { level: 1, name: UI.ru.title }).waitFor(WAIT);
    expect(await reopened.getByLabel(UI.ru.address).inputValue()).toBe(SERVER_URL);
    await shot(reopened, '07-from-user-menu');
    // A second request focuses the open window instead of opening another one.
    await clickConnectionMenuItem();
    expect(app.windows().filter(isSettingsPage)).toHaveLength(1);
    try {
      await reopened.getByRole('button', { name: UI.ru.cancel }).click();
    } catch (error) {
      if (!reopened.isClosed()) throw error;
    }
    await waitUntilClosed(app, isSettingsPage, 30_000);
    expect(new URL(web.url()).pathname).not.toMatch(/^\/login/);
  });

  it('settings.json contains only the documented fields and no secrets', async () => {
    const text = await readFile(settingsFile(), 'utf8');
    const settings = JSON.parse(text) as Record<string, unknown>;
    for (const key of Object.keys(settings)) expect(DOCUMENTED_FIELDS).toContain(key);
    expect(settings).toMatchObject({ serverUrl: SERVER_URL, printer: null, silentPrint: false, kiosk: false, autoStart: false, language: 'ru' });
    expect(text).not.toContain(DEMO_PASSWORD);
    expect(text).not.toContain(ACCOUNTS.admin);
    expect(text).not.toMatch(/token|password|cookie|secret|bearer|eyJ/i);
  });

  it('refuses to save an unreachable address: the window stays open, nothing is stored, the user stays signed in', async () => {
    const reopened = await openFromMenu();
    await testAddress(reopened, 'ru', deadUrl);
    await reopened.getByText(UI.ru.unreachable).waitFor(WAIT);
    const cookiesBefore = await cookieNames();
    expect(cookiesBefore.length).toBeGreaterThan(0);
    await reopened.getByRole('button', { name: UI.ru.save }).click();

    // Main asks the new address before it stores it: a typo must not sign the user out of a working server.
    await expect.poll(() => reopened.locator('#form-error').textContent(), WAIT).toBe(UI.ru.unreachable);
    await shot(reopened, '09-wrong-server');
    expect(reopened.isClosed()).toBe(false);
    expect(await savedSettings()).toMatchObject({ serverUrl: SERVER_URL });
    expect(await cookieNames()).toEqual(cookiesBefore);
    expect(await web.evaluate(() => localStorage.getItem('scenario-marker'))).not.toBeNull();
    expect(new URL(web.url()).pathname).not.toMatch(/^\/login/);

    try {
      await reopened.getByRole('button', { name: UI.ru.cancel }).click();
    } catch (error) {
      if (!reopened.isClosed()) throw error;
    }
    await waitUntilClosed(app, isSettingsPage, 30_000);
  });

  it('changing to another reachable address drops the old session and the app works again', async () => {
    const reopened = await openFromMenu();
    expect(await reopened.getByLabel(UI.ru.address).inputValue()).toBe(SERVER_URL);
    await testAddress(reopened, 'ru', otherUrl);
    await reopened.getByText(UI.ru.ok).waitFor(WAIT);
    await clickSave(reopened, 'ru');
    await waitUntilClosed(app, isSettingsPage, 30_000);
    expect(await savedSettings()).toMatchObject({ serverUrl: otherUrl, language: 'ru' });

    // Documented: session cookie, device token and cached ids belong to the previous server and are dropped.
    await web.getByRole('form', { name: LOGIN_FORM }).waitFor(WAIT);
    expect(await web.evaluate(() => localStorage.getItem('scenario-marker'))).toBeNull();
    const refresh = await web.evaluate(async () => (await fetch('/api/v1/auth/refresh', { method: 'POST' })).status);
    expect(refresh).toBe(401);
    await loginWithPassword(web, ACCOUNTS.admin);
    expect(new URL(web.url()).pathname).not.toMatch(/^\/login/);
    await shot(web, '10-back');
  });

  it('a relaunch with the same profile goes straight to the app', async () => {
    const closingAt = Date.now();
    await started.close();
    const closedAt = Date.now();
    started = await startApp({ profile, gatewayPort });
    console.info(`[first-run] relaunch: close ${closedAt - closingAt} ms, start ${Date.now() - closedAt} ms`);
    if (!started.app) throw new Error('The development build exposes the Electron handle');
    app = started.app;
    web = started.page;
    expect(isWebAppPage(web)).toBe(true);
    expect(app.windows().filter(isSettingsPage)).toHaveLength(0);
    await web.getByRole('heading').first().waitFor(WAIT);
    await shot(web, '11-relaunch');
    console.info(`[first-run] after relaunch: ${web.url()}`);
    const settings = await savedSettings();
    for (const key of Object.keys(settings)) expect(DOCUMENTED_FIELDS).toContain(key);
    expect(settings).toMatchObject({ serverUrl: otherUrl, language: 'ru' });
  });
});
