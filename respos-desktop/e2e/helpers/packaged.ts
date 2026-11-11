import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { type Browser, chromium, type Page } from 'playwright';
import { freeGatewayPort, type LaunchOptions } from './launch';

/**
 * Drives the PACKAGED app (`release/win-unpacked/RestaurantOS.exe`). Its fuses switch `--inspect` off, so
 * Playwright's Electron driver (which needs the main-process inspector) cannot start it. The renderers are
 * still reachable through Chromium's own `--remote-debugging-port`, which is all a smoke test needs: there is
 * no handle on the main process here, only pages.
 */
export interface PackagedApp {
  readonly process: ChildProcess;
  /** Everything the app wrote to stdout / stderr (its log lines). */
  readonly output: string[];
  pages(): Page[];
  /** Waits for a window whose URL matches. */
  page(matches: (page: Page) => boolean, timeoutMs?: number): Promise<Page>;
  /** Closes every window (the app then quits by itself) and resolves with the exit code. */
  quit(): Promise<number | null>;
  /** Last resort for cleanup after a failed test. */
  kill(): void;
}

/** The portable exe unpacks itself into the temp folder before it starts: allow for a slow disk. */
const CONNECT_TIMEOUT_MS = 90_000;
const EXIT_TIMEOUT_MS = 20_000;

/** A second copy only has to notice the running one and leave (the portable exe unpacks itself first). */
const SECOND_INSTANCE_TIMEOUT_MS = 90_000;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ends a process together with everything it started. The portable exe is a launcher: the app itself is its
 * child process and would stay on screen if only the launcher were killed.
 */
function killTree(child: ChildProcess): void {
  if (child.exitCode !== null || child.pid === undefined) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGKILL');
}

export function packagedEnvironment(userDataDir: string, options: LaunchOptions = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) env[name] = value;
  }
  // Deliberately set: with the RunAsNode fuse off the packaged exe must ignore it and start the app anyway.
  env.ELECTRON_RUN_AS_NODE = '1';
  env.RESPOS_DESKTOP_USER_DATA = userDataDir;
  env.RESPOS_DESKTOP_GATEWAY_PORT = String(options.gatewayPort ?? 0);
  if (options.printCaptureFile !== undefined) env.RESPOS_DESKTOP_PRINT_CAPTURE = options.printCaptureFile;
  else delete env.RESPOS_DESKTOP_PRINT_CAPTURE;
  return env;
}

async function connect(endpoint: string, child: ChildProcess): Promise<Browser> {
  const deadline = Date.now() + CONNECT_TIMEOUT_MS;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`The packaged app exited with code ${child.exitCode} before it could be reached`);
    try {
      return await chromium.connectOverCDP(endpoint);
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await delay(250);
    }
  }
}

export async function launchPackagedApp(executable: string, userDataDir: string, options: LaunchOptions = {}): Promise<PackagedApp> {
  const debugPort = await freeGatewayPort();
  const child = spawn(executable, [`--remote-debugging-port=${debugPort}`, ...(options.args ?? [])], {
    env: packagedEnvironment(userDataDir, options),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output: string[] = [];
  child.stdout?.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
  child.stderr?.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
  const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));

  let browser: Browser;
  try {
    browser = await connect(`http://127.0.0.1:${debugPort}`, child);
  } catch (error) {
    killTree(child);
    throw new Error(`Cannot reach the packaged app: ${String(error)}\n${output.join('')}`, { cause: error });
  }

  const pages = (): Page[] => browser.contexts().flatMap((context) => context.pages());

  return {
    process: child,
    output,
    pages,
    page: async (matches, timeoutMs = 30_000) => {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const found = pages().find(matches);
        if (found) return found;
        if (Date.now() > deadline) {
          throw new Error(`No matching window; open: ${pages().map((page) => page.url()).join(', ')}\n${output.join('')}`);
        }
        await delay(100);
      }
    },
    quit: async () => {
      for (const page of pages()) await page.close().catch(() => undefined);
      const code = await Promise.race([exited, delay(EXIT_TIMEOUT_MS).then(() => 'timeout' as const)]);
      await browser.close().catch(() => undefined);
      if (code === 'timeout') {
        killTree(child);
        throw new Error('The packaged app did not exit after its windows were closed');
      }
      return code;
    },
    kill: () => killTree(child),
  };
}

/** Starts another copy of the packaged app on the same profile and resolves with its exit code. */
export function runSecondPackagedInstance(executable: string, userDataDir: string, options: LaunchOptions = {}): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, options.args ?? [], { env: packagedEnvironment(userDataDir, options), stdio: 'ignore' });
    const timer = setTimeout(() => {
      killTree(child);
      reject(new Error('The second copy of the packaged app did not exit'));
    }, SECOND_INSTANCE_TIMEOUT_MS);
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
