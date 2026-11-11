import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';

/** Windows-side helpers of the installer scenario: registry, shortcuts, NSIS installer / uninstaller, exe resources. */

const UNINSTALL_ROOT = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall';
const SHELL_FOLDERS = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders';
export const PRODUCT = 'RestaurantOS';

export interface UninstallEntry {
  key: string;
  values: Record<string, string>;
}

function reg(args: string[]): { code: number | null; out: string } {
  const run = spawnSync('reg', args, { encoding: 'utf8', windowsHide: true });
  return { code: run.status, out: `${run.stdout ?? ''}` };
}

function readValues(key: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of reg(['query', key]).out.split(/\r?\n/)) {
    const match = /^\s{4}(\S.*?)\s{4}REG_\w+\s{4}(.*)$/.exec(line);
    if (match?.[1] !== undefined) values[match[1]] = match[2] ?? '';
  }
  return values;
}

/** Every per-user "Programs and features" entry whose DisplayName mentions the product. */
export function uninstallEntries(): UninstallEntry[] {
  const keys = reg(['query', UNINSTALL_ROOT]).out.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('HKEY_'));
  return keys
    .map((key) => ({ key, values: readValues(key) }))
    .filter((entry) => (entry.values.DisplayName ?? '').includes(PRODUCT));
}

export function deleteRegistryKey(key: string): void {
  reg(['delete', key, '/f']);
}

function desktopDir(): string {
  const line = reg(['query', SHELL_FOLDERS, '/v', 'Desktop']).out.split(/\r?\n/).find((text) => text.includes('REG_'));
  const raw = line?.split(/\s{4}/).pop()?.trim();
  const home = process.env.USERPROFILE ?? '';
  return raw ? raw.replace(/%USERPROFILE%/i, home) : path.join(home, 'Desktop');
}

export const startMenuShortcut = (): string =>
  path.join(process.env.APPDATA ?? '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${PRODUCT}.lnk`);
export const desktopShortcut = (): string => path.join(desktopDir(), `${PRODUCT}.lnk`);

/** Runs an exe with the arguments passed verbatim (NSIS wants `/D=<dir>` unquoted and last). */
export function runVerbatim(exe: string, args: string[], timeoutMs: number): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { stdio: 'ignore', windowsVerbatimArguments: true, windowsHide: true });
    const timer = setTimeout(() => {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      reject(new Error(`${path.basename(exe)} ${args.join(' ')} did not finish in ${timeoutMs} ms`));
    }, timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

export async function waitUntil(label: string, check: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out after ${timeoutMs} ms: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/** Version resources of an exe (ProductName, ProductVersion, FileVersion, CompanyName, FileDescription). */
export function versionInfo(exe: string): Record<string, string | null> {
  const script = `(Get-Item -LiteralPath '${exe}').VersionInfo | Select-Object ProductName,ProductVersion,FileVersion,FileDescription,CompanyName,LegalCopyright | ConvertTo-Json -Compress`;
  const run = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true });
  if (run.status !== 0) throw new Error(`Cannot read the version resources of ${exe}: ${run.stderr}`);
  return JSON.parse(run.stdout.trim()) as Record<string, string | null>;
}

/** Ends every running copy of the app that was started from `dir` (leftovers of a failed test). */
export function killAppsIn(dir: string): void {
  const script = `Get-Process -Name '${PRODUCT}' -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '${dir}*' } | Stop-Process -Force`;
  spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'ignore', windowsHide: true });
}

export const registryKeyExists = (key: string): boolean => reg(['query', key]).code === 0;

export const uninstallerPath =(installDir: string): string => path.join(installDir, `Uninstall ${PRODUCT}.exe`);

/**
 * Silent uninstall. The NSIS uninstaller copies itself to the temp folder and returns at once, so the caller
 * waits for the install folder to disappear. Resolves with `false` when there was nothing to uninstall.
 */
export async function silentUninstall(installDir: string, timeoutMs = 120_000): Promise<boolean> {
  const uninstaller = uninstallerPath(installDir);
  if (!existsSync(uninstaller)) return false;
  await runVerbatim(uninstaller, ['/currentuser', '/S'], timeoutMs);
  await waitUntil(`${installDir} is removed by the uninstaller`, () => !existsSync(path.join(installDir, `${PRODUCT}.exe`)) && !existsSync(uninstaller), timeoutMs);
  return true;
}

/** Folder of the uninstaller an entry points at (`"<dir>/Uninstall RestaurantOS.exe" /currentuser`, with backslashes). */
export function entryInstallDir(entry: UninstallEntry): string | undefined {
  const match = /^"?([^"]+)\\Uninstall [^"\\]+\.exe/i.exec(entry.values.UninstallString ?? '');
  return match?.[1];
}

/**
 * Safety net for afterAll (only used when the machine had no RestaurantOS before the test): whatever the
 * uninstaller left behind is removed by hand. Returns what it had to remove.
 */
export async function forceCleanup(installDir: string): Promise<string[]> {
  const removed: string[] = [];
  for (const entry of uninstallEntries()) {
    const dir = entryInstallDir(entry);
    if (dir !== undefined && dir.toLowerCase() !== installDir.toLowerCase()) await silentUninstall(dir).catch(() => undefined);
  }
  for (const entry of uninstallEntries()) {
    deleteRegistryKey(entry.key);
    deleteRegistryKey(`HKCU\\Software\\${path.win32.basename(entry.key)}`);
    removed.push(entry.key);
  }
  for (const file of [startMenuShortcut(), desktopShortcut()]) {
    if (!existsSync(file)) continue;
    await rm(file, { force: true });
    removed.push(file);
  }
  if (existsSync(installDir)) {
    await rm(installDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    removed.push(installDir);
  }
  return removed;
}
