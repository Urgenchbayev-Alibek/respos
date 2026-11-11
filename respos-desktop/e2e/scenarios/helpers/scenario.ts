import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ElectronApplication, Page } from 'playwright';
import { isSettingsPage, isWebAppPage, launchApp, settingsWindow, webAppWindow } from '../../helpers/launch';
import { launchPackagedApp, type PackagedApp } from '../../helpers/packaged';
import { monitorPage, type PageMonitor } from '../../helpers/page-monitor';

import { trackSession } from './api';

export { api, trackSession, waitFor, waitForApi, type ApiResult } from './api';
export { monitorPage, type PageMonitor };

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — run scenarios with "npm run scenario <key>"`);
  return value;
}

/** Address of this scenario's own backend, e.g. `http://127.0.0.1:5092`. */
export const SERVER_URL = required('RESPOS_SCENARIO_SERVER_URL');
export const SCENARIO_KEY = required('RESPOS_SCENARIO_KEY');
/** `D:/tmp/respos-e2e/<key>` — profiles, print captures, the API log (`api.log`). */
export const SCENARIO_DIR = required('RESPOS_SCENARIO_DIR');

/** Demo seed accounts (Development only). Login is limited to 5 per minute per e-mail: sign in once per account. */
export const DEMO_PASSWORD = 'Demo123!';
export const ACCOUNTS = {
  admin: 'admin@demo.respos.uz',
  manager: 'manager@demo.respos.uz',
  waiter: 'waiter@demo.respos.uz',
  cook: 'cook@demo.respos.uz',
  cashier: 'cashier@demo.respos.uz',
  stock: 'stock@demo.respos.uz',
} as const;
export const PINS = { waiter: '2580', cashier: '3690', cook: '1470' } as const;

export interface StartOptions {
  /** Name of the user-data folder under SCENARIO_DIR/profiles. Omitted → a fresh one; reuse a name to relaunch on the same profile. */
  profile?: string;
  /** `false` leaves a fresh profile without a server address: the app opens its connection window (first run). */
  configured?: boolean;
  /** Fixed gateway port keeps the web app's origin (localStorage) between launches; default: any free port. */
  gatewayPort?: number;
  /** Extra command-line arguments (`--kiosk`). */
  args?: string[];
  /** File that receives print jobs instead of a printer. */
  printCaptureFile?: string;
  /** Path of a packaged `RestaurantOS.exe`: driven over CDP, so `app` is undefined and `packaged` is set. */
  packagedExe?: string;
}

export interface StartedApp {
  /** Playwright handle on the Electron main process (development build only). */
  app?: ElectronApplication;
  packaged?: PackagedApp;
  /** The web app window — or the connection window when the profile has no server address. */
  page: Page;
  /** Console errors, failed requests and live WebSockets of `page`, recorded from the start. */
  monitor: PageMonitor;
  userDataDir: string;
  /** Closes the app; safe to call twice. Call it in afterAll. */
  close(): Promise<void>;
}

let profileCounter = 0;

/** Launches the desktop app on a profile that already points at this scenario's backend. */
export async function startApp(options: StartOptions = {}): Promise<StartedApp> {
  profileCounter += 1;
  const profile = options.profile ?? `profile-${Date.now()}-${profileCounter}`;
  const userDataDir = path.join(SCENARIO_DIR, 'profiles', profile);
  await mkdir(userDataDir, { recursive: true });
  const settingsFile = path.join(userDataDir, 'settings.json');
  const configured = options.configured ?? true;
  if (configured && !existsSync(settingsFile)) await writeFile(settingsFile, JSON.stringify({ serverUrl: SERVER_URL }));
  const expectsWebApp = existsSync(settingsFile);
  const launch = { args: options.args, gatewayPort: options.gatewayPort, printCaptureFile: options.printCaptureFile };

  if (options.packagedExe !== undefined) {
    const packaged = await launchPackagedApp(options.packagedExe, userDataDir, launch);
    let closed = false;
    const close = async (): Promise<void> => {
      if (closed) return;
      closed = true;
      await packaged.quit().catch(() => packaged.kill());
    };
    try {
      const page = await packaged.page(expectsWebApp ? isWebAppPage : isSettingsPage, 90_000);
      await page.waitForLoadState('domcontentloaded');
      trackSession(page);
      return { packaged, page, monitor: monitorPage(page), userDataDir, close };
    } catch (error) {
      packaged.kill();
      throw error;
    }
  }

  const app = await launchApp(userDataDir, launch);
  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await app.close().catch(() => undefined);
  };
  try {
    const page = expectsWebApp ? await webAppWindow(app, 90_000) : await settingsWindow(app);
    trackSession(page);
    return { app, page, monitor: monitorPage(page), userDataDir, close };
  } catch (error) {
    await close();
    throw error;
  }
}

/**
 * Signs in through the real login form (Russian UI) and waits until the workspace has rendered:
 * the address has left /login and the page shows its main heading.
 */
export async function loginWithPassword(page: Page, email: string, password: string = DEMO_PASSWORD): Promise<void> {
  const form = page.getByRole('form', { name: 'Вход в RestaurantOS' });
  await form.waitFor({ state: 'visible', timeout: 60_000 });
  await form.getByLabel('Email').fill(email);
  await form.getByLabel('Пароль').fill(password);
  await form.getByRole('button', { name: 'Войти' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60_000 });
  await page.getByRole('heading').first().waitFor({ state: 'visible', timeout: 60_000 });
}
