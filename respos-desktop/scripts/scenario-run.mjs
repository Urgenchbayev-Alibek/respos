#!/usr/bin/env node
// Runs end-to-end scenarios, each against its own backend (see scenario-stack.mjs):
//   node scripts/scenario-run.mjs <key> [--keep]   stack up → vitest e2e/scenarios/<key>.scenario.ts → stack down
//   node scripts/scenario-run.mjs --all            every scenario file, one after another, with a summary table
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { down, scenarioDir, up } from './scenario-stack.mjs';

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCENARIOS_DIR = join(APP_DIR, 'e2e', 'scenarios');
const SUFFIX = '.scenario.ts';

/** One fixed API port per scenario, so several scenarios can run side by side. */
export const PORTS = {
  sanity: 5090,
  'first-run': 5091,
  admin: 5092,
  realtime: 5093,
  cashier: 5094,
  'stock-delivery': 5095,
  resilience: 5096,
  installer: 5097,
  'ui-modes': 5098,
};

/** DESIGN.md "Environment rules": caches and temp files stay on drive D:. */
const ENVIRONMENT_DEFAULTS = {
  TEMP: 'D:\\tmp\\desktop',
  TMP: 'D:\\tmp\\desktop',
  npm_config_cache: 'D:\\tmp\\npm-cache',
  ELECTRON_CACHE: 'D:\\tmp\\electron-cache',
  ELECTRON_BUILDER_CACHE: 'D:\\tmp\\electron-builder-cache',
  PLAYWRIGHT_BROWSERS_PATH: 'D:\\tmp\\pw-browsers',
};

function runVitest(key, url) {
  const dir = scenarioDir(key);
  const reportFile = join(dir, 'result.json');
  rmSync(reportFile, { force: true });
  const args = [
    join(APP_DIR, 'node_modules', 'vitest', 'vitest.mjs'), 'run',
    '--config', 'vitest.scenarios.config.mts',
    '--reporter=default', '--reporter=json', `--outputFile.json=${reportFile}`,
    `e2e/scenarios/${key}${SUFFIX}`,
  ];
  const env = {
    ...ENVIRONMENT_DEFAULTS,
    ...process.env,
    RESPOS_SCENARIO_SERVER_URL: url,
    RESPOS_SCENARIO_KEY: key,
    RESPOS_SCENARIO_DIR: dir,
  };
  return new Promise((done) => {
    const child = spawn(process.execPath, args, { cwd: APP_DIR, env, stdio: 'inherit' });
    child.on('error', () => done({ code: 1, reportFile }));
    child.on('exit', (code) => done({ code: code ?? 1, reportFile }));
  });
}

function readCounts(reportFile) {
  try {
    const report = JSON.parse(readFileSync(reportFile, 'utf8'));
    return { passed: report.numPassedTests ?? 0, failed: report.numFailedTests ?? 0 };
  } catch {
    return { passed: 0, failed: 0 };
  }
}

async function runScenario(key, keep) {
  const startedAt = Date.now();
  const result = { key, passed: 0, failed: 0, ok: false, seconds: 0, note: '' };
  const port = PORTS[key];
  if (port === undefined) result.note = `no port for "${key}" in scripts/scenario-run.mjs`;
  else if (!existsSync(join(SCENARIOS_DIR, `${key}${SUFFIX}`))) result.note = `e2e/scenarios/${key}${SUFFIX} does not exist`;
  else {
    try {
      mkdirSync(ENVIRONMENT_DEFAULTS.TEMP, { recursive: true });
      const url = await up(key, port);
      console.info(`[${key}] backend ready at ${url} (${Math.round((Date.now() - startedAt) / 1000)} s)`);
      const run = await runVitest(key, url);
      Object.assign(result, readCounts(run.reportFile));
      result.ok = run.code === 0;
      if (!result.ok && result.failed === 0) result.note = `vitest exited with code ${run.code}`;
    } catch (error) {
      result.note = error.message;
    } finally {
      if (keep) console.info(`[${key}] stack kept — stop it with: node scripts/scenario-stack.mjs down ${key}`);
      else await down(key).catch((error) => console.error(`[${key}] stack down failed: ${error.message}`));
    }
  }
  if (result.note) console.error(`[${key}] ${result.note}`);
  result.seconds = Math.round((Date.now() - startedAt) / 1000);
  return result;
}

function printSummary(results) {
  console.info('\nkey              result  passed  failed  duration');
  for (const row of results) {
    const cells = [row.key.padEnd(16), (row.ok ? 'PASS' : 'FAIL').padEnd(7), String(row.passed).padStart(6), String(row.failed).padStart(7), `${String(row.seconds).padStart(7)} s`];
    console.info(`${cells.join(' ')}${row.note ? `  ${row.note}` : ''}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const keep = args.includes('--keep');
  const keys = args.includes('--all')
    ? readdirSync(SCENARIOS_DIR).filter((name) => name.endsWith(SUFFIX)).map((name) => name.slice(0, -SUFFIX.length)).sort()
    : args.filter((arg) => !arg.startsWith('--'));
  if (keys.length === 0) {
    console.info(`usage: node scripts/scenario-run.mjs <key> [--keep] | --all\nkeys: ${Object.keys(PORTS).join(', ')}`);
    process.exitCode = 2;
    return;
  }
  const results = [];
  for (const key of keys) results.push(await runScenario(key, keep));
  if (results.length > 1) printSummary(results);
  process.exitCode = results.every((row) => row.ok) ? 0 : 1;
}

main().catch((error) => {
  console.error(`scenario-run: ${error.message}`);
  process.exitCode = 1;
});
