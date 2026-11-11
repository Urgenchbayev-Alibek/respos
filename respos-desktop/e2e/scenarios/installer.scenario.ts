import { existsSync, readdirSync, statSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { extractFile, listPackage } from '@electron/asar';
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APP_DIR, isWebAppPage } from '../helpers/launch';
import { ACCOUNTS, SCENARIO_DIR, SERVER_URL, api, loginWithPassword, monitorPage, startApp, trackSession, type StartedApp } from './helpers/scenario';
import {
  PRODUCT,
  desktopShortcut,
  forceCleanup,
  killAppsIn,
  registryKeyExists,
  runVerbatim,
  silentUninstall,
  startMenuShortcut,
  uninstallEntries,
  uninstallerPath,
  versionInfo,
  waitUntil,
} from './installer.helpers';

/**
 * Installer scenario: the artifacts in release/, a silent per-user install, the INSTALLED exe driven through
 * its first-run connection window against this scenario's backend, a silent uninstall, and the portable exe.
 * afterAll always uninstalls and removes whatever is left, so the machine keeps no RestaurantOS entry.
 */
const RELEASE = path.join(APP_DIR, 'release');
const UNPACKED = path.join(RELEASE, 'win-unpacked');
const ARCHIVE = path.join(UNPACKED, 'resources', 'app.asar');
const INSTALL_DIR = path.win32.normalize(path.join(SCENARIO_DIR, 'app'));
const INSTALLED_EXE = path.join(INSTALL_DIR, `${PRODUCT}.exe`);
const LOGIN_FORM = 'Вход в RestaurantOS';
const WAIT = { timeout: 90_000 };
/** Windows prints the version resources with four parts (`0.1.0.0`). */
const versionResource = (version: string): RegExp => new RegExp(`^${version.replaceAll('.', '[.]')}([.]0)?$`);
/** Measured on the loaded test machine: silent install 138 s, silent uninstall more than 180 s. */
const INSTALLER_TEST_TIMEOUT_MS = 480_000;

describe('installer: setup exe, installed app, uninstall, portable exe', () => {
  let version = '';
  let setupExe = '';
  let portableExe = '';
  /** A RestaurantOS that was on the machine BEFORE the test: the one-click installer would replace it, so nothing is installed then. */
  let foreignInstall = false;
  let installed = false;
  let softwareKey = '';
  const running: StartedApp[] = [];

  const shot = (page: Page, name: string): Promise<unknown> =>
    page.screenshot({ path: path.join(SCENARIO_DIR, `${name}.png`) }).catch(() => undefined);

  /** Signs in as the admin on a web-app page and checks the dashboard, the API session and the console. */
  const signInAndCheckDashboard = async (page: Page, label: string): Promise<void> => {
    const monitor = monitorPage(page);
    await page.getByRole('form', { name: LOGIN_FORM }).waitFor({ state: 'visible', ...WAIT });
    monitor.reset(); // a fresh profile logs one 401 for the start-up POST /auth/refresh
    await loginWithPassword(page, ACCOUNTS.admin);
    await page.getByRole('heading', { level: 1, name: 'Дашборд' }).waitFor({ state: 'visible', ...WAIT });
    await shot(page, `${label}-dashboard`);
    const me = await api<{ email: string }>(page, 'GET', '/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(ACCOUNTS.admin);
    expect(monitor.errors).toEqual([]);
    monitor.stop();
  };

  beforeAll(async () => {
    version = (JSON.parse(await readFile(path.join(APP_DIR, 'package.json'), 'utf8')) as { version: string }).version;
    setupExe = path.join(RELEASE, `${PRODUCT}-Setup-${version}.exe`);
    portableExe = path.join(RELEASE, `${PRODUCT}-${version}-portable.exe`);
    foreignInstall = uninstallEntries().length > 0 || existsSync(startMenuShortcut());
    if (!foreignInstall) await rm(INSTALL_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    await mkdir(SCENARIO_DIR, { recursive: true });
  });

  afterAll(async () => {
    for (const app of running.splice(0)) await app.close().catch(() => undefined);
    if (foreignInstall) return;
    killAppsIn(INSTALL_DIR);
    await silentUninstall(INSTALL_DIR).catch((error: unknown) => console.error(`[installer] uninstall in afterAll failed: ${String(error)}`));
    const removed = await forceCleanup(INSTALL_DIR);
    if (removed.length > 0) console.warn(`[installer] removed by hand after the uninstaller: ${removed.join(', ')}`);
  });

  it('release/ holds the setup exe and the unpacked app (the portable exe is recorded)', () => {
    expect(existsSync(setupExe), setupExe).toBe(true);
    expect(statSync(setupExe).size).toBeGreaterThan(50 * 1024 * 1024);
    expect(existsSync(path.join(UNPACKED, `${PRODUCT}.exe`))).toBe(true);
    expect(existsSync(ARCHIVE)).toBe(true);
    expect(existsSync(path.join(UNPACKED, 'resources', 'web-dist', 'index.html'))).toBe(true);
    console.info(`[installer] portable exe ${existsSync(portableExe) ? 'present' : 'ABSENT'}: ${portableExe}`);
  });

  it('app.asar holds only the bundles, the assets and package.json — no sources, tests, maps or node_modules', () => {
    const entries = listPackage(ARCHIVE, { isPack: false }).map((entry) => entry.replace(/\\/g, '/'));
    expect(entries).toEqual(
      expect.arrayContaining(['/dist/main/main.js', '/dist/preload/app-preload.js', '/dist/preload/settings-preload.js', '/dist/settings/index.html', '/package.json']),
    );
    expect(entries.filter((entry) => !/^\/(dist|assets)(\/|$)/.test(entry) && entry !== '/package.json')).toEqual([]);
    expect(entries.filter((entry) => /node_modules|\/(src|e2e|tests|scripts)(\/|$)|\.(ts|tsx|map|md)$|\.env|tsconfig|vitest|eslint/i.test(entry))).toEqual([]);

    // resources/: the archive and the built web app only; the web app ships without source maps or sources.
    const resources = readdirSync(path.join(UNPACKED, 'resources'));
    expect(resources.filter((name) => !['app.asar', 'web-dist', 'app-update.yml', 'elevate.exe'].includes(name))).toEqual([]);
    const webFiles = readdirSync(path.join(UNPACKED, 'resources', 'web-dist'), { recursive: true }).map(String);
    expect(webFiles.filter((name) => /\.(map|ts|tsx)$|node_modules|\.env/i.test(name))).toEqual([]);

    // package.json inside the archive: the right entry point and no runtime dependencies (nothing to install).
    const manifest = JSON.parse(extractFile(ARCHIVE, 'package.json').toString('utf8')) as Record<string, unknown>;
    expect(manifest.version).toBe(version);
    expect(manifest.main).toBe('dist/main/main.js');
    expect(Object.keys((manifest.dependencies as Record<string, string> | undefined) ?? {})).toEqual([]);
    expect(manifest.devDependencies).toBeUndefined();
    expect(manifest.scripts).toBeUndefined();
  });

  it('the exe carries the product name and version resources', () => {
    const app = versionInfo(path.join(UNPACKED, `${PRODUCT}.exe`));
    expect(app.ProductName).toBe(PRODUCT);
    expect(app.ProductVersion ?? '').toMatch(versionResource(version));
    expect(app.FileVersion ?? '').toMatch(versionResource(version));
    expect(app.FileDescription).toBe(PRODUCT);
    expect(app.LegalCopyright ?? '').toContain(PRODUCT);
    const setup = versionInfo(setupExe);
    expect(setup.ProductName).toBe(PRODUCT);
    expect(setup.ProductVersion ?? '').toContain(version);
  });

  it('installs silently per user into the given folder: files, uninstall entry, shortcuts', async () => {
    expect(foreignInstall, 'a RestaurantOS installation already exists on this machine — the test does not touch it').toBe(false);
    // NSIS: /S = silent, /D=<dir> must be the LAST argument, with backslashes and without quotes.
    installed = true;
    const code = await runVerbatim(setupExe, ['/S', `/D=${INSTALL_DIR}`], 300_000);
    expect(code).toBe(0);
    await waitUntil('the installed exe appears', () => existsSync(INSTALLED_EXE), 30_000);

    expect(existsSync(path.join(INSTALL_DIR, 'resources', 'app.asar'))).toBe(true);
    expect(existsSync(path.join(INSTALL_DIR, 'resources', 'web-dist', 'index.html'))).toBe(true);
    expect(existsSync(uninstallerPath(INSTALL_DIR))).toBe(true);
    expect(versionInfo(INSTALLED_EXE).ProductVersion ?? '').toMatch(versionResource(version));

    const entries = uninstallEntries();
    expect(entries).toHaveLength(1);
    const entry = entries[0]?.values ?? {};
    softwareKey = `HKCU\\Software\\${path.win32.basename(entries[0]?.key ?? '')}`;
    expect(entries[0]?.key.startsWith('HKEY_CURRENT_USER')).toBe(true);
    expect(entry.DisplayName).toBe(`${PRODUCT} ${version}`);
    expect(entry.DisplayVersion).toBe(version);
    expect((entry.UninstallString ?? '').toLowerCase()).toContain(uninstallerPath(INSTALL_DIR).toLowerCase());
    expect(registryKeyExists(softwareKey)).toBe(true);

    expect(existsSync(startMenuShortcut()), startMenuShortcut()).toBe(true);
    expect(existsSync(desktopShortcut()), desktopShortcut()).toBe(true);
  }, INSTALLER_TEST_TIMEOUT_MS);

  it('the INSTALLED app: first-run connection window → backend → admin signs in → dashboard → clean exit', async () => {
    expect(installed && existsSync(INSTALLED_EXE), 'the app is not installed').toBe(true);
    const started = await startApp({ packagedExe: INSTALLED_EXE, configured: false, profile: `installed-${Date.now()}` });
    running.push(started);
    const packaged = started.packaged;
    if (!packaged) throw new Error('startApp did not return the packaged handle');
    const connection = started.page;
    await connection.getByRole('heading', { level: 1, name: 'Настройки подключения' }).waitFor({ state: 'visible', ...WAIT });
    await expect.poll(() => connection.getByText(version, { exact: true }).count(), WAIT).toBeGreaterThan(0);
    await connection.getByLabel('Адрес сервера').fill(SERVER_URL);
    await connection.getByRole('button', { name: 'Проверить соединение' }).click();
    await connection.getByText('Соединение установлено').waitFor({ state: 'visible', ...WAIT });
    await shot(connection, 'installed-connection');
    // Save closes its own window: the click may be cut short by that.
    await connection.getByRole('button', { name: 'Сохранить' }).click().catch((error: unknown) => {
      if (!connection.isClosed()) throw error;
    });

    const web = await packaged.page(isWebAppPage, 90_000);
    trackSession(web);
    await signInAndCheckDashboard(web, 'installed');
    const saved = JSON.parse(await readFile(path.join(started.userDataDir, 'settings.json'), 'utf8')) as { serverUrl?: string };
    expect(saved.serverUrl).toBe(SERVER_URL);
    // The app runs from the install folder, not from release/.
    expect(packaged.process.spawnfile.toLowerCase()).toBe(INSTALLED_EXE.toLowerCase());

    expect(await packaged.quit()).toBe(0);
    running.splice(running.indexOf(started), 1);
  });

  it('uninstalls silently: folder, uninstall entry, registry key and shortcuts are gone', async () => {
    expect(installed, 'the app is not installed').toBe(true);
    expect(await silentUninstall(INSTALL_DIR, 200_000)).toBe(true);
    await waitUntil('the uninstall entry is removed', () => uninstallEntries().length === 0, 60_000);
    await waitUntil('the install folder is removed', () => !existsSync(INSTALL_DIR), 60_000);
    expect(softwareKey !== '' && registryKeyExists(softwareKey)).toBe(false);
    expect(existsSync(startMenuShortcut())).toBe(false);
    expect(existsSync(desktopShortcut())).toBe(false);
    installed = false;
  }, INSTALLER_TEST_TIMEOUT_MS);

  it('the portable exe starts on an isolated profile and signs in', async (context) => {
    if (!existsSync(portableExe)) {
      console.info(`[installer] NOT COVERED: ${portableExe} does not exist (the final packaging rebuilds it)`);
      context.skip();
      return;
    }
    expect(versionInfo(portableExe).ProductName).toBe(PRODUCT);
    const started = await startApp({ packagedExe: portableExe, profile: `portable-${Date.now()}` });
    running.push(started);
    await signInAndCheckDashboard(started.page, 'portable');
    expect(uninstallEntries()).toEqual([]); // a portable run registers nothing
    expect(await started.packaged?.quit()).toBe(0);
    running.splice(running.indexOf(started), 1);
  }, 300_000);
});
