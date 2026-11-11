import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APP_DIR, clickClosing, freeGatewayPort, settingsWindow } from '../helpers/launch';
import { ACCOUNTS, loginWithPassword, SCENARIO_DIR, SERVER_URL, startApp, waitFor, type StartedApp } from './helpers/scenario';

type Lang = 'ru' | 'uz' | 'en';
const SHOTS = path.join(SCENARIO_DIR, 'shots');
const LOCALES = path.resolve(APP_DIR, '..', 'respos-admin', 'src', 'shared', 'i18n', 'locales');

/** Expected text straight from the web app's own locale resources (`tr('uz', 'dashboard', 'title')`). */
function tr(lang: Lang, namespace: string, key: string): string {
  let node: unknown = JSON.parse(readFileSync(path.join(LOCALES, lang, `${namespace}.json`), 'utf8'));
  for (const part of key.split('.')) node = (node as Record<string, unknown>)[part];
  if (typeof node !== 'string') throw new Error(`no ${lang}/${namespace}:${key}`);
  return node;
}

/** i18next prints the key itself when a translation is missing: `nav.topbar.language`, `ux:theme.dark`. */
const RAW_KEY = /\b(?:nav|common|ux|dashboard|status|errors|notifications|settings|reports|analytics|orders|cashier|auth)[:.][a-z][A-Za-z]*(?:\.[A-Za-z]+)+\b/g;

async function rawKeys(page: Page): Promise<string[]> {
  const text = await page.evaluate(() => document.body.innerText);
  return text.match(RAW_KEY) ?? [];
}

interface WindowState {
  bounds: { x: number; y: number; width: number; height: number };
  kiosk: boolean;
  fullScreen: boolean;
  menuBarVisible: boolean;
  zoomLevel: number;
  backgroundColor: string;
}

/** State of the window that shows the web app, read in the main process. */
function windowState(app: ElectronApplication): Promise<WindowState> {
  return app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().startsWith('http://127.0.0.1'));
    if (!window) throw new Error('no web app window');
    return {
      bounds: window.getBounds(),
      kiosk: window.isKiosk(),
      fullScreen: window.isFullScreen(),
      menuBarVisible: window.isMenuBarVisible(),
      zoomLevel: window.webContents.getZoomLevel(),
      backgroundColor: window.getBackgroundColor(),
    };
  });
}

/** Labels of the application menu: top level and every submenu item, flattened. */
function menuLabels(app: ElectronApplication): Promise<{ top: string[]; all: string[] }> {
  return app.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu();
    const all: string[] = [];
    const walk = (items: Electron.MenuItem[]): void => {
      for (const item of items) {
        if (item.type === 'separator') continue;
        all.push(item.label);
        if (item.submenu) walk(item.submenu.items);
      }
    };
    walk(menu?.items ?? []);
    return { top: (menu?.items ?? []).map((item) => item.label), all };
  });
}

/** Clicks an application-menu item by its label (what the user does with the mouse). */
function clickMenuItem(app: ElectronApplication, label: string): Promise<boolean> {
  return app.evaluate(({ Menu, BrowserWindow }, wanted) => {
    const find = (items: Electron.MenuItem[]): Electron.MenuItem | undefined => {
      for (const item of items) {
        if (item.label === wanted) return item;
        const nested = item.submenu ? find(item.submenu.items) : undefined;
        if (nested) return nested;
      }
      return undefined;
    };
    const item = find(Menu.getApplicationMenu()?.items ?? []);
    const window = BrowserWindow.getAllWindows().find((entry) => entry.webContents.getURL().startsWith('http://127.0.0.1'));
    if (!item || !window) return false;
    (item.click as (event: unknown, target: unknown, contents: unknown) => void)(undefined, window, window.webContents);
    return true;
  }, label);
}

function readSettings(userDataDir: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(userDataDir, 'settings.json'), 'utf8')) as Record<string, unknown>;
}

/** Effective page background (body, else html) and its relative luminance 0..1; `null` when both are transparent. */
function pageBackground(page: Page): Promise<{ theme: string | null; color: string; luminance: number | null }> {
  return page.evaluate(() => {
    const parse = (value: string): number[] | null => {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
      if (parts.length < 3 || (parts.length > 3 && parts[3] === 0)) return null;
      return parts.slice(0, 3);
    };
    const body = getComputedStyle(document.body).backgroundColor;
    const html = getComputedStyle(document.documentElement).backgroundColor;
    const rgb = parse(body) ?? parse(html);
    const luminance = rgb ? (0.2126 * (rgb[0] ?? 0) + 0.7152 * (rgb[1] ?? 0) + 0.0722 * (rgb[2] ?? 0)) / 255 : null;
    return { theme: document.documentElement.getAttribute('data-theme'), color: `${body} / ${html}`, luminance };
  });
}

async function noHorizontalOverflow(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
}

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => undefined);
}

async function switchLanguage(page: Page, from: Lang, to: Lang): Promise<void> {
  await page.getByRole('button', { name: tr(from, 'nav', 'topbar.language') }).click();
  await page.getByRole('menuitem', { name: tr(from, 'common', `languages.${to}`) }).click();
  await page.getByRole('heading', { level: 1, name: tr(to, 'dashboard', 'title') }).waitFor({ state: 'visible', timeout: 30_000 });
}

describe('ui-modes: language, theme, shortcuts, menu, zoom, window state, autostart, kiosk', () => {
  let gatewayPort = 0;
  let main: StartedApp | undefined;
  let relaunched: StartedApp | undefined;
  let kiosk: StartedApp | undefined;
  let relaunchedBackground = '';
  const wantedBounds = { x: 140, y: 90, width: 1180, height: 780 };

  beforeAll(async () => {
    gatewayPort = await freeGatewayPort(); // fixed origin: localStorage (language, theme) must survive the relaunch
    main = await startApp({ profile: 'main', gatewayPort });
    await main.page.getByRole('form', { name: tr('ru', 'auth', 'login.title') }).waitFor({ state: 'visible', timeout: 90_000 });
    main.monitor.reset(); // the start-up refresh 401 of a fresh profile
    await loginWithPassword(main.page, ACCOUNTS.admin);
    await main.page.getByRole('heading', { level: 1, name: tr('ru', 'dashboard', 'title') }).waitFor({ state: 'visible', timeout: 60_000 });
  });

  afterAll(async () => {
    await main?.close();
    await relaunched?.close();
    await kiosk?.close();
  });

  it('application menu is Russian by default (shell language ru)', async () => {
    const labels = await menuLabels(main!.app!);
    expect(labels.top).toEqual(['Файл', 'Вид', 'Справка']);
    expect(labels.all).toEqual(expect.arrayContaining(['Настройки подключения', 'Перезагрузить', 'Выход', 'Во весь экран', 'Масштаб', 'О программе']));
    expect(labels.all).not.toContain('Выйти из режима киоска');
  });

  it('switches the web app language RU → UZ → EN without raw i18n keys', async () => {
    const { page } = main!;
    expect(await rawKeys(page)).toEqual([]);
    await switchLanguage(page, 'ru', 'uz');
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('uz');
    await shot(page, 'lang-uz');
    expect(await rawKeys(page)).toEqual([]);
    expect(await page.getByRole('heading', { level: 1, name: tr('ru', 'dashboard', 'title') }).count()).toBe(0);
    await switchLanguage(page, 'uz', 'en');
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
    await shot(page, 'lang-en');
    expect(await rawKeys(page)).toEqual([]);
  });

  it('turns the dark theme on from the user menu', async () => {
    const { page } = main!;
    await page.getByRole('button', { name: tr('en', 'nav', 'topbar.userMenu') }).click();
    await page.getByRole('menuitem', { name: tr('en', 'ux', 'theme.dark') }).click();
    await waitFor('html[data-theme=dark]', async () => (await pageBackground(page)).theme === 'dark', 15_000);
    const background = await pageBackground(page);
    await shot(page, 'theme-dark');
    expect(background.luminance, background.color).not.toBeNull();
    expect(background.luminance!, background.color).toBeLessThan(0.2);
  });

  it('web app shortcuts work inside Electron: "?" opens the help, F2 focuses the order search', async () => {
    const { page } = main!;
    await page.goto(`${new URL(page.url()).origin}/cashier`);
    const helpButton = page.getByRole('button', { name: tr('en', 'ux', 'shortcuts.title') });
    await helpButton.waitFor({ state: 'visible', timeout: 60_000 });
    await shot(page, 'cashier');
    await page.locator('body').click({ position: { x: 5, y: 5 } }); // focus the page, not a field
    await page.keyboard.press('Shift+?');
    const dialog = page.getByRole('dialog', { name: tr('en', 'ux', 'shortcuts.title') });
    await dialog.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(dialog.getByText('F2', { exact: true }).count()).resolves.toBeGreaterThan(0);
    await expect(dialog.getByText(tr('en', 'ux', 'shortcuts.cashier.search')).count()).resolves.toBeGreaterThan(0);
    expect(await rawKeys(page)).toEqual([]);
    await shot(page, 'shortcuts-help');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden', timeout: 15_000 });

    await page.keyboard.press('F2');
    const placeholder = tr('en', 'cashier', 'orders.searchPlaceholder');
    await waitFor('F2 focuses the order search', () => page.evaluate((text) => (document.activeElement as HTMLInputElement | null)?.placeholder === text, placeholder), 15_000);
    await page.keyboard.type('zz');
    expect(await page.getByPlaceholder(placeholder).inputValue()).toBe('zz');
    await page.getByPlaceholder(placeholder).fill('');
    // The app menu must not have stolen the keys: still the cashier screen, same zoom, not full screen.
    const state = await windowState(main!.app!);
    expect(state.zoomLevel).toBe(0);
    expect(state.fullScreen).toBe(false);
  });

  it('zoom in / out / reset keep the layout intact', async () => {
    const { page, app } = main!;
    const labels = { in: 'Увеличить', out: 'Уменьшить', reset: 'Исходный размер' };
    // Native menu accelerators are not reachable for CDP-injected keys, so the key press is tried first and the
    // menu item (same role) is the fallback; `viaKeyboard` records which one worked.
    const step = async (keys: string, label: string, expected: (level: number) => boolean): Promise<boolean> => {
      await page.keyboard.press(keys);
      const viaKeyboard = await waitFor(`zoom after ${keys}`, async () => expected((await windowState(app!)).zoomLevel), 3_000).then(() => true, () => false);
      if (!viaKeyboard) {
        expect(await clickMenuItem(app!, label)).toBe(true);
        await waitFor(`zoom after menu "${label}"`, async () => expected((await windowState(app!)).zoomLevel), 10_000);
      }
      const size = await noHorizontalOverflow(page);
      await shot(page, `zoom-${label}`);
      expect(size.scrollWidth, `horizontal overflow after "${label}"`).toBeLessThanOrEqual(size.clientWidth + 1);
      await expect(page.getByRole('button', { name: tr('en', 'nav', 'topbar.userMenu') }).isVisible()).resolves.toBe(true);
      return viaKeyboard;
    };
    const viaKeyboard = [
      await step('Control+Equal', labels.in, (level) => level > 0),
      await step('Control+Minus', labels.out, (level) => level <= 0),
      await step('Control+Minus', labels.out, (level) => level < 0),
      await step('Control+0', labels.reset, (level) => level === 0),
    ];
    console.info(`[ui-modes] zoom steps handled by the keyboard accelerator: ${JSON.stringify(viaKeyboard)}`);
    expect((await windowState(app!)).zoomLevel).toBe(0);
  });

  it('the main session logged no console errors', () => {
    expect(main!.monitor.errors).toEqual([]);
  });

  it('relaunch restores window bounds, language, dark theme (no light flash) and the shell language', async () => {
    const { app, userDataDir } = main!;
    await app!.evaluate(({ BrowserWindow }, bounds) => {
      const window = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().startsWith('http://127.0.0.1'));
      window?.unmaximize();
      window?.setBounds(bounds);
    }, wantedBounds);
    const moved = (await windowState(app!)).bounds;
    await waitFor('window bounds saved to settings.json', () => {
      const saved = readSettings(userDataDir).windowBounds as { width?: number } | null | undefined;
      return Math.abs((saved?.width ?? 0) - moved.width) <= 2;
    }, 20_000);
    await main!.close();
    const settings = readSettings(userDataDir);
    writeFileSync(path.join(userDataDir, 'settings.json'), JSON.stringify({ ...settings, language: 'en' })); // shell language is a settings.json field

    relaunched = await startApp({ profile: 'main', gatewayPort });
    const { page } = relaunched;
    const early = await pageBackground(page); // right after DOMContentLoaded, before anything else
    const state = await windowState(relaunched.app!);
    console.info(`[ui-modes] after relaunch: page ${JSON.stringify(early)}, window ${JSON.stringify(state)}`);
    expect(early.theme).toBe('dark');
    expect(early.luminance, early.color).not.toBeNull();
    expect(early.luminance!, early.color).toBeLessThan(0.2);
    for (const side of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(state.bounds[side] - moved[side]), side).toBeLessThanOrEqual(8);

    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
    await page.getByRole('heading', { level: 1, name: tr('en', 'dashboard', 'title') }).waitFor({ state: 'visible', timeout: 60_000 });
    await shot(page, 'relaunched');
    expect(await rawKeys(page)).toEqual([]);
    expect((await menuLabels(relaunched.app!)).top).toEqual(['File', 'View', 'Help']);
    relaunchedBackground = state.backgroundColor.toLowerCase();
  });

  // BUG (low): the native window background stays the light #f8fafc with the dark theme stored, so the frame is
  // light until the first dark page paint (start-up, reload, resize gaps) — src/main/main-window.ts
  // `backgroundColor: '#f8fafc'`. `it.fails`: turns red once the shell picks the colour from the theme.
  it.fails('native window background follows the dark theme', () => {
    expect(relaunchedBackground).not.toBe('');
    expect(relaunchedBackground).not.toBe('#f8fafc');
  });

  it('autostart setting toggles through the connection window and is OFF at the end', async () => {
    const { app, userDataDir } = relaunched!;
    const loginItem = (): Promise<boolean> => app!.evaluate(({ app: electronApp }) => electronApp.getLoginItemSettings().openAtLogin);
    const packagedBuild = await app!.evaluate(({ app: electronApp }) => electronApp.isPackaged);
    const before = await loginItem();
    const toggle = async (checked: boolean): Promise<void> => {
      expect(await clickMenuItem(app!, 'Connection settings')).toBe(true);
      const settingsPage = await settingsWindow(app!);
      await settingsPage.setChecked('#auto-start', checked);
      await clickClosing(settingsPage, '#save-button');
      await waitFor(`settings.json autoStart=${String(checked)}`, () => readSettings(userDataDir).autoStart === checked, 30_000);
    };
    try {
      await toggle(true);
      // A development run stores the flag but must not register the bare electron.exe (src/main/autostart.ts).
      console.info(`[ui-modes] autostart on: packaged=${String(packagedBuild)} loginItem before=${String(before)} after=${String(await loginItem())}`);
      expect(await loginItem()).toBe(packagedBuild);
    } finally {
      await toggle(false);
    }
    expect(readSettings(userDataDir).autoStart).toBe(false);
    expect(await loginItem()).toBe(false);
    await relaunched!.close();
  });

  it('--kiosk: full screen without a menu bar, Uzbek menu, Ctrl+Shift+Q leaves kiosk mode', async () => {
    const profileDir = path.join(SCENARIO_DIR, 'profiles', 'kiosk');
    mkdirSync(profileDir, { recursive: true });
    writeFileSync(path.join(profileDir, 'settings.json'), JSON.stringify({ serverUrl: SERVER_URL, language: 'uz' }));
    kiosk = await startApp({ profile: 'kiosk', args: ['--kiosk'] });
    const { app, page } = kiosk;
    await page.getByRole('form', { name: tr('ru', 'auth', 'login.title') }).waitFor({ state: 'visible', timeout: 90_000 });
    await waitFor('kiosk window state', async () => (await windowState(app!)).kiosk, 20_000);
    const state = await windowState(app!);
    const display = await app!.evaluate(({ screen }) => screen.getPrimaryDisplay().bounds);
    await shot(page, 'kiosk');
    expect(state.fullScreen).toBe(true);
    expect(state.menuBarVisible).toBe(false);
    expect(state.bounds.width).toBe(display.width);
    expect(state.bounds.height).toBe(display.height);
    const labels = await menuLabels(app!);
    expect(labels.top).toEqual(['Fayl', 'Ko‘rinish', 'Yordam']);
    expect(labels.all).toContain('Kiosk rejimidan chiqish');

    let exited = false;
    app!.process().once('exit', () => (exited = true));
    const left = async (): Promise<boolean> => exited || !(await windowState(app!)).kiosk;
    await page.keyboard.press('Control+Shift+Q');
    // Playwright keys are CDP-injected; if the shell's before-input-event hook does not see them, the same chord is
    // sent as a native input event from the main process. `via` records which one worked.
    let via = 'keyboard';
    if (!(await waitFor('kiosk left (keyboard)', left, 5_000).then(() => true, () => false))) {
      via = 'sendInputEvent';
      await app!.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().startsWith('http://127.0.0.1'));
        window?.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Q', modifiers: ['control', 'shift'] });
        window?.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Q', modifiers: ['control', 'shift'] });
      });
      await waitFor('Ctrl+Shift+Q ends kiosk mode', left, 20_000);
    }
    console.info(`[ui-modes] Ctrl+Shift+Q handled via ${via}`);
    console.info(`[ui-modes] after Ctrl+Shift+Q: process exited=${String(exited)}`);
    if (!exited) {
      const after = await windowState(app!);
      expect(after.fullScreen).toBe(false);
      expect(after.menuBarVisible).toBe(true);
    }
  });
});
