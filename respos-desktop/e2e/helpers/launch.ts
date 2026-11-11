import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import net, { type AddressInfo } from 'node:net';
import path from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { isBrowserSafePort } from '../../src/gateway/ports';

/** `respos-desktop/` — the app is launched from its build output (`npm run build` first). */
export const APP_DIR = path.resolve(import.meta.dirname, '..', '..');

export const SETTINGS_URL_PREFIX = 'respos-shell://settings/';
export const GATEWAY_URL = /^http:\/\/127\.0\.0\.1:\d+\//;

export interface LaunchOptions {
  /** Extra command-line arguments (`--kiosk`). */
  args?: string[];
  /** Gateway port; default `0` = any free port. A fixed port keeps the web app's origin between launches. */
  gatewayPort?: number;
  /** File that receives the print jobs instead of a printer (RESPOS_DESKTOP_PRINT_CAPTURE). */
  printCaptureFile?: string;
}

/** The test's own environment plus the test hooks of main.ts: an isolated profile and a chosen gateway port. */
export function appEnvironment(userDataDir: string, options: LaunchOptions = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && name !== 'ELECTRON_RUN_AS_NODE') env[name] = value;
  }
  env.RESPOS_DESKTOP_USER_DATA = userDataDir;
  env.RESPOS_DESKTOP_GATEWAY_PORT = String(options.gatewayPort ?? 0);
  if (options.printCaptureFile !== undefined) env.RESPOS_DESKTOP_PRINT_CAPTURE = options.printCaptureFile;
  else delete env.RESPOS_DESKTOP_PRINT_CAPTURE;
  return env;
}

/** Starts the built app with its own user-data folder. Development build: fuses are not flipped here. */
export function launchApp(userDataDir: string, options: LaunchOptions = {}): Promise<ElectronApplication> {
  return electron.launch({
    args: [APP_DIR, ...(options.args ?? [])],
    cwd: APP_DIR,
    env: appEnvironment(userDataDir, options),
  });
}

/** A free loopback port the renderer is allowed to load from (Chromium refuses a few well-known ports). */
export async function freeGatewayPort(): Promise<number> {
  for (;;) {
    const port = await new Promise<number>((resolve, reject) => {
      const probe = net.createServer();
      probe.once('error', reject);
      probe.listen(0, '127.0.0.1', () => {
        const found = (probe.address() as AddressInfo).port;
        probe.close(() => resolve(found));
      });
    });
    if (isBrowserSafePort(port)) return port;
  }
}

/** Starts a second copy of the app on the same profile and resolves with its exit code. */
export function runSecondInstance(userDataDir: string): Promise<number | null> {
  const executable = createRequire(path.join(APP_DIR, 'package.json'))('electron') as unknown as string;
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [APP_DIR], { cwd: APP_DIR, env: appEnvironment(userDataDir), stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code));
  });
}

export function isSettingsPage(page: Page): boolean {
  return page.url().startsWith(SETTINGS_URL_PREFIX);
}

export function isWebAppPage(page: Page): boolean {
  return GATEWAY_URL.test(page.url());
}

async function waitForWindow(app: ElectronApplication, matches: (page: Page) => boolean, timeoutMs = 30_000): Promise<Page> {
  const deadline = Date.now() + timeoutMs;
  // Polled on purpose: a new window reports its URL only some time after the 'window' event.
  for (;;) {
    const found = app.windows().find(matches);
    if (found) return found;
    if (Date.now() > deadline) throw new Error(`No matching window; open: ${app.windows().map((page) => page.url()).join(', ')}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** The window showing the web app (gateway origin), waiting for it to open if necessary. */
export async function webAppWindow(app: ElectronApplication, timeoutMs?: number): Promise<Page> {
  const page = await waitForWindow(app, isWebAppPage, timeoutMs);
  await page.waitForLoadState('domcontentloaded');
  return page;
}

/** The connection window with its form loaded, waiting for it to open if necessary. */
export async function settingsWindow(app: ElectronApplication): Promise<Page> {
  const page = await waitForWindow(app, isSettingsPage);
  await page.waitForSelector('#fields:not([disabled])');
  return page;
}

/**
 * Clicks a button that makes its own window go away (Save, Cancel in the connection window). The window can be
 * gone before the click is acknowledged; that is the expected outcome, not a failure.
 */
export async function clickClosing(page: Page, selector: string): Promise<void> {
  try {
    await page.click(selector);
  } catch (error) {
    if (!page.isClosed()) throw error;
  }
}

/** Resolves once no window of that kind is open any more. */
export async function waitUntilClosed(app: ElectronApplication, matches: (page: Page) => boolean, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (app.windows().some(matches)) {
    if (Date.now() > deadline) throw new Error('The window is still open');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
