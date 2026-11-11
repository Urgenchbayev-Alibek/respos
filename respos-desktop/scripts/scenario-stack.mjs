#!/usr/bin/env node
// One isolated backend per end-to-end scenario: its own database in the respos-desktop-pg container and its own
// API process (published once to D:/tmp/respos-e2e/api), started detached so it survives the calling shell.
//   node scripts/scenario-stack.mjs up <key> <port> | down <key> | down --all | status
//   node scripts/scenario-stack.mjs stop-api <key> | start-api <key> | restart-api <key>   (the database is kept)
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = process.env.RESPOS_SCENARIO_ROOT ?? 'D:/tmp/respos-e2e';
const API_DIR = join(ROOT_DIR, 'api');
const CONTAINER = 'respos-desktop-pg';
const PG = { port: 5434, user: 'respos', password: 'respos_dev', defaultDb: 'respos' };
const READY_TIMEOUT_MS = 240_000;
const IS_WINDOWS = process.platform === 'win32';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export const scenarioDir = (key) => join(ROOT_DIR, key);
export const serverUrl = (port) => `http://127.0.0.1:${port}`;
const stateFile = (key) => join(scenarioDir(key), 'stack.json');
const databaseName = (key) => `respos_sc_${key.replaceAll('-', '_')}`;

function checkKey(key) {
  if (!key || !/^[a-z][a-z0-9-]{0,30}$/.test(key) || key === 'api') throw new Error(`invalid scenario key "${key ?? ''}"`);
  return key;
}

/** Runs a command and returns trimmed stdout, or null when it fails. */
function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function readState(key) {
  try {
    return JSON.parse(readFileSync(stateFile(key), 'utf8'));
  } catch {
    return null;
  }
}

function writeState(key, state) {
  mkdirSync(scenarioDir(key), { recursive: true });
  writeFileSync(stateFile(key), `${JSON.stringify(state, null, 2)}\n`);
}

async function isReady(port) {
  try {
    const response = await fetch(`${serverUrl(port)}/health/ready`, { signal: AbortSignal.timeout(4000) });
    return response.ok;
  } catch {
    return false;
  }
}

/** True when something already listens on the loopback port. */
function portBusy(port) {
  return new Promise((done) => {
    const probe = net.createServer();
    probe.once('error', () => done(true));
    probe.listen(port, '127.0.0.1', () => probe.close(() => done(false)));
  });
}

async function ensurePostgres() {
  const status = run('docker', ['inspect', '-f', '{{.State.Status}}', CONTAINER]);
  if (status === null) {
    const created = run('docker', [
      'run', '-d', '--name', CONTAINER,
      '-e', `POSTGRES_DB=${PG.defaultDb}`, '-e', `POSTGRES_USER=${PG.user}`, '-e', `POSTGRES_PASSWORD=${PG.password}`,
      '-p', `${PG.port}:5432`, 'postgres:16-alpine',
    ]);
    if (created === null) throw new Error(`could not create the ${CONTAINER} container (is Docker running?)`);
  } else if (status !== 'running' && run('docker', ['start', CONTAINER]) === null) {
    throw new Error(`could not start ${CONTAINER}`);
  }
  const deadline = Date.now() + 90_000;
  while (run('docker', ['exec', CONTAINER, 'pg_isready', '-U', PG.user, '-d', 'postgres']) === null) {
    if (Date.now() > deadline) throw new Error('postgres is not ready after 90 s');
    await sleep(1000);
  }
}

function sql(statement) {
  const out = run('docker', ['exec', CONTAINER, 'psql', '-U', PG.user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', statement]);
  if (out === null) throw new Error(`postgres refused: ${statement}`);
}

const dropDatabase = (key) => sql(`DROP DATABASE IF EXISTS ${databaseName(key)} WITH (FORCE)`);

function killTree(pid) {
  if (!pid) return;
  if (IS_WINDOWS) run('taskkill', ['/PID', String(pid), '/T', '/F']);
  else {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
}

/** Starts the published API for an existing state entry and waits until it answers /health/ready. */
async function startApi(key, state) {
  if (!existsSync(join(API_DIR, 'Restaurant.Api.dll'))) {
    throw new Error(`no published API in ${API_DIR} — run: dotnet publish respos-backend/src/Restaurant.Api -c Release -o ${API_DIR}`);
  }
  if (await portBusy(state.port)) throw new Error(`port ${state.port} is busy — another process (or scenario) is using it`);
  const dir = scenarioDir(key);
  mkdirSync(join(dir, 'storage'), { recursive: true });
  const log = openSync(join(dir, 'api.log'), 'a');
  const env = { ...process.env };
  delete env.ASPNETCORE_URLS;
  const child = spawn('dotnet', ['Restaurant.Api.dll', '--urls', serverUrl(state.port)], {
    // The published folder is the content root (appsettings*.json); everything the API writes goes to the scenario folder.
    cwd: API_DIR,
    env: {
      ...env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      DOTNET_ENVIRONMENT: 'Development',
      // Generous timeouts: on a loaded machine the docker port proxy can take longer than Npgsql's default 15 s.
      ConnectionStrings__DefaultConnection:
        `Host=localhost;Port=${PG.port};Database=${state.database};Username=${PG.user};Password=${PG.password};Timeout=120;Command Timeout=300`,
      FileStorage__LocalRoot: join(dir, 'storage'),
    },
    detached: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
  });
  child.unref();
  closeSync(log);
  writeState(key, { ...state, pid: child.pid, startedAt: new Date().toISOString() });

  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (!(await isReady(state.port))) {
    if (child.exitCode !== null) throw new Error(`the API exited with code ${child.exitCode} (see ${join(dir, 'api.log')})`);
    if (Date.now() > deadline) throw new Error(`the API is not ready after ${READY_TIMEOUT_MS / 1000} s (see ${join(dir, 'api.log')})`);
    await sleep(1000);
  }
}

async function stopApi(key) {
  const state = readState(key);
  if (!state?.pid) return state;
  killTree(state.pid);
  const deadline = Date.now() + 15_000;
  while ((await portBusy(state.port)) && Date.now() < deadline) await sleep(300);
  const stopped = { ...state, pid: null };
  writeState(key, stopped);
  return stopped;
}

/** Fresh database + API for the scenario. Resolves with the server URL. */
export async function up(key, port) {
  checkKey(key);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`invalid port "${port}"`);
  await stopApi(key);
  await ensurePostgres();
  if (await portBusy(port)) throw new Error(`port ${port} is busy — another process (or scenario) is using it`);
  dropDatabase(key);
  sql(`CREATE DATABASE ${databaseName(key)}`);
  rmSync(join(scenarioDir(key), 'storage'), { recursive: true, force: true });
  await startApi(key, { key, port, database: databaseName(key), pid: null });
  return serverUrl(port);
}

export async function down(key) {
  checkKey(key);
  await stopApi(key);
  if (run('docker', ['inspect', '-f', '{{.State.Status}}', CONTAINER]) === 'running') dropDatabase(key);
  rmSync(stateFile(key), { force: true });
}

function knownKeys() {
  if (!existsSync(ROOT_DIR)) return [];
  return readdirSync(ROOT_DIR).filter((name) => existsSync(stateFile(name)));
}

function requireState(key) {
  const state = readState(checkKey(key));
  if (!state) throw new Error(`scenario "${key}" has no stack — run "up ${key} <port>" first`);
  return state;
}

async function main() {
  const [command, key, portText] = process.argv.slice(2);
  if (command === 'up') {
    console.log(await up(key, Number(portText)));
  } else if (command === 'down' && key === '--all') {
    for (const name of knownKeys()) {
      await down(name);
      console.log(`${name}: down`);
    }
  } else if (command === 'down') {
    await down(key);
    console.log(`${key}: down`);
  } else if (command === 'stop-api') {
    requireState(key);
    await stopApi(key);
    console.log(`${key}: API stopped (database kept)`);
  } else if (command === 'start-api' || command === 'restart-api') {
    requireState(key);
    const state = await stopApi(key);
    await startApi(key, state);
    console.log(serverUrl(state.port));
  } else if (command === 'status') {
    const keys = knownKeys();
    if (keys.length === 0) console.log('no scenario stacks');
    for (const name of keys) {
      const state = readState(name);
      const ready = await isReady(state.port);
      console.log(`${name.padEnd(16)} ${ready ? 'UP  ' : 'DOWN'} ${serverUrl(state.port)}  db ${state.database}  pid ${state.pid ?? '-'}`);
    }
  } else {
    console.log('usage: node scripts/scenario-stack.mjs up <key> <port> | down <key>|--all | status | stop-api|start-api|restart-api <key>');
    process.exitCode = 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`scenario-stack: ${error.message}`);
    process.exitCode = 1;
  });
}
