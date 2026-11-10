#!/usr/bin/env node
// Isolated test stack for the design work (never touches the default dev ports 5080 / 5173 / 5174 / 5433).
//   node scripts/design-shots/stack.mjs up | status | down [--purge] | down api|admin|landing (one process only)
// Postgres container respos-design-pg :5435, API :5082, admin Vite :5183, landing Vite :5184.
// Processes are started detached (they survive the calling shell); logs and the pid file live in DESIGN_STACK_DIR.
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORK_DIR = process.env.DESIGN_STACK_DIR ?? 'D:/tmp/design';
const LOG_DIR = join(WORK_DIR, 'logs');
const STATE_FILE = join(WORK_DIR, 'stack-state.json');
const IS_WINDOWS = process.platform === 'win32';

export const PORTS = { postgres: 5435, api: 5082, admin: 5183, landing: 5184 };
export const URLS = {
  api: `http://localhost:${PORTS.api}`,
  apiBase: `http://localhost:${PORTS.api}/api/v1`,
  hub: `http://localhost:${PORTS.api}/hubs/restaurant`,
  admin: `http://localhost:${PORTS.admin}`,
  landing: `http://localhost:${PORTS.landing}`,
};
const CONTAINER = 'respos-design-pg';
const DB = { name: 'respos', user: 'respos', password: 'respos_dev' };

const baseEnv = {
  ...process.env,
  TEMP: process.env.TEMP ?? WORK_DIR,
  TMP: process.env.TMP ?? WORK_DIR,
  npm_config_cache: process.env.npm_config_cache ?? 'D:/tmp/npm-cache',
};

/** Long-running processes of the stack: how to start them and how to tell they are ready. */
const SERVICES = [
  {
    name: 'api',
    probe: `${URLS.api}/health/ready`,
    timeoutMs: 300_000,
    command: 'dotnet',
    args: ['run', '--project', 'respos-backend/src/Restaurant.Api', '--no-launch-profile', '--urls', URLS.api],
    cwd: ROOT,
    env: {
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__DefaultConnection: `Host=localhost;Port=${PORTS.postgres};Database=${DB.name};Username=${DB.user};Password=${DB.password}`,
      // appsettings.Development.json declares an array, so the indexed keys are what actually replaces it.
      // The default dev origins stay allowed too: the scripts/e2e scenario asserts CORS for :5173 / :5174.
      Frontend__AllowedOrigins: `${URLS.admin},${URLS.landing}`,
      Frontend__AllowedOrigins__0: URLS.admin,
      Frontend__AllowedOrigins__1: URLS.landing,
      Frontend__AllowedOrigins__2: 'http://localhost:5173',
      Frontend__AllowedOrigins__3: 'http://localhost:5174',
    },
  },
  {
    name: 'admin',
    probe: `${URLS.admin}/`,
    timeoutMs: 90_000,
    command: process.execPath,
    args: ['node_modules/vite/bin/vite.js', '--port', String(PORTS.admin), '--strictPort'],
    cwd: join(ROOT, 'respos-admin'),
    env: { VITE_API_BASE_URL: URLS.apiBase, VITE_HUB_URL: URLS.hub, VITE_LANDING_URL: URLS.landing },
  },
  {
    name: 'landing',
    probe: `${URLS.landing}/`,
    timeoutMs: 90_000,
    command: process.execPath,
    args: ['node_modules/vite/bin/vite.js', '--port', String(PORTS.landing), '--strictPort'],
    cwd: join(ROOT, 'respos-landing'),
    env: { VITE_API_BASE_URL: URLS.apiBase, VITE_ADMIN_APP_URL: URLS.admin, VITE_PUBLIC_BRANCH_SLUG: 'demo' },
  },
];

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function readState() {
  if (!existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  mkdirSync(WORK_DIR, { recursive: true });
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

/** Runs a command and returns trimmed stdout, or null when it fails. */
function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: baseEnv }).trim();
  } catch {
    return null;
  }
}

/** One retry: a busy machine (build, capture run) can miss a single probe. */
async function isUp(url) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) return true;
    } catch {
      // not answering yet
    }
    if (attempt === 0) await sleep(1000);
  }
  return false;
}

async function waitFor(label, check, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(1500);
  }
  throw new Error(`${label} is not ready after ${Math.round(timeoutMs / 1000)} s (see ${LOG_DIR})`);
}

function containerStatus() {
  return run('docker', ['inspect', '-f', '{{.State.Status}}', CONTAINER]);
}

const postgresReady = () => run('docker', ['exec', CONTAINER, 'pg_isready', '-U', DB.user, '-d', DB.name]) !== null;

async function ensurePostgres() {
  const status = containerStatus();
  if (status === null) {
    const created = run('docker', [
      'run', '-d', '--name', CONTAINER,
      '-e', `POSTGRES_DB=${DB.name}`, '-e', `POSTGRES_USER=${DB.user}`, '-e', `POSTGRES_PASSWORD=${DB.password}`,
      '-p', `${PORTS.postgres}:5432`, 'postgres:16-alpine',
    ]);
    if (created === null) throw new Error(`could not create the ${CONTAINER} container (is Docker running?)`);
    console.log(`postgres  created ${CONTAINER} on :${PORTS.postgres}`);
  } else if (status !== 'running') {
    if (run('docker', ['start', CONTAINER]) === null) throw new Error(`could not start ${CONTAINER}`);
    console.log(`postgres  started ${CONTAINER}`);
  }
  await waitFor('postgres', async () => postgresReady(), 90_000);
  console.log(`postgres  ready   localhost:${PORTS.postgres}`);
}

function startDetached(service) {
  mkdirSync(LOG_DIR, { recursive: true });
  const log = openSync(join(LOG_DIR, `${service.name}.log`), 'a');
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    env: { ...baseEnv, ...service.env },
    detached: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
  });
  child.unref();
  closeSync(log);
  return child.pid;
}

function killTree(pid) {
  if (!pid) return;
  if (IS_WINDOWS) {
    run('taskkill', ['/PID', String(pid), '/T', '/F']);
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    // already gone
  }
}

/** PIDs listening on a TCP port (Windows only; used to stop children that outlived their launcher). */
function listenersOn(port) {
  if (!IS_WINDOWS) return [];
  const out = run('netstat', ['-ano', '-p', 'TCP']) ?? '';
  const pids = out.split(/\r?\n/)
    .filter((line) => /LISTENING/.test(line) && new RegExp(`:${port}\\s`).test(line))
    .map((line) => Number(line.trim().split(/\s+/).pop()))
    .filter((pid) => pid > 0);
  return [...new Set(pids)];
}

async function up() {
  await ensurePostgres();
  const state = readState();
  for (const service of SERVICES) {
    if (await isUp(service.probe)) {
      console.log(`${service.name.padEnd(9)} already up`);
      continue;
    }
    state[service.name] = { pid: startDetached(service), startedAt: new Date().toISOString() };
    writeState(state);
    console.log(`${service.name.padEnd(9)} starting (pid ${state[service.name].pid}, log ${join(LOG_DIR, `${service.name}.log`)})`);
  }
  for (const service of SERVICES) {
    await waitFor(service.name, () => isUp(service.probe), service.timeoutMs);
    console.log(`${service.name.padEnd(9)} ready   ${service.probe}`);
  }
}

async function status() {
  const state = readState();
  const pg = containerStatus();
  console.log(`postgres  ${pg === 'running' && postgresReady() ? 'UP  ' : 'DOWN'}  ${CONTAINER} (${pg ?? 'missing'}) localhost:${PORTS.postgres}`);
  let allUp = pg === 'running';
  for (const service of SERVICES) {
    const ok = await isUp(service.probe);
    allUp &&= ok;
    const pid = state[service.name]?.pid;
    console.log(`${service.name.padEnd(9)} ${ok ? 'UP  ' : 'DOWN'}  ${service.probe}${pid ? `  (pid ${pid})` : ''}`);
  }
  return allUp;
}

/** Stops the processes this script started. With service names only those are stopped and Postgres keeps running. */
async function down(purge, only) {
  const state = readState();
  for (const service of SERVICES) {
    const entry = state[service.name];
    if (!entry || (only.length > 0 && !only.includes(service.name))) continue;
    killTree(entry.pid);
    const port = PORTS[service.name];
    for (const pid of listenersOn(port)) killTree(pid);
    delete state[service.name];
    console.log(`${service.name.padEnd(9)} stopped`);
  }
  if (only.length > 0) {
    writeState(state);
    return;
  }
  if (existsSync(STATE_FILE)) rmSync(STATE_FILE);
  if (purge) {
    run('docker', ['rm', '-f', '-v', CONTAINER]);
    console.log(`postgres  removed ${CONTAINER}`);
  } else if (containerStatus() === 'running') {
    run('docker', ['stop', CONTAINER]);
    console.log(`postgres  stopped ${CONTAINER} (data kept; --purge removes it)`);
  }
}

async function main() {
  const [command, ...flags] = process.argv.slice(2);
  if (command === 'up') {
    await up();
  } else if (command === 'status') {
    process.exitCode = (await status()) ? 0 : 1;
  } else if (command === 'down') {
    await down(flags.includes('--purge'), flags.filter((flag) => !flag.startsWith('--')));
  } else {
    console.log('usage: node scripts/design-shots/stack.mjs up | status | down [--purge] | down <api|admin|landing>');
    process.exitCode = 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`stack: ${error.message}`);
    process.exitCode = 1;
  });
}
