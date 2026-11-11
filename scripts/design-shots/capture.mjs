#!/usr/bin/env node
// Design capture: PNG screenshots + short WebM interaction clips + manifest.json for one label.
//   node scripts/design-shots/capture.mjs <label> [--only id,id] [--screens | --clips] [--headed]
// Output: docs/design/assets/redesign/<label>/. Needs the stack from stack.mjs (see README.md).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_URL, API_URL, LANDING_URL, ROOT, SESSIONS, VIEWPORTS, chromium, openSession, pause, prepareData } from './lib.mjs';
import { CLIPS } from './clips.mjs';
import { SCREENS } from './screens.mjs';

function parseArgs(argv) {
  const options = { label: null, only: null, screens: true, clips: true, headed: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--only') options.only = new Set((argv[i += 1] ?? '').split(',').map((id) => id.trim()).filter(Boolean));
    else if (arg === '--screens') options.clips = false;
    else if (arg === '--clips') options.screens = false;
    else if (arg === '--headed') options.headed = true;
    else if (!arg.startsWith('--') && options.label === null) options.label = arg;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!options.label || !/^[a-z0-9][a-z0-9-]*$/.test(options.label)) {
    throw new Error('usage: capture.mjs <label> [--only id,id] [--screens | --clips] [--headed]   (label: a-z, 0-9, "-")');
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const outDir = join(ROOT, 'docs', 'design', 'assets', 'redesign', options.label);
const failedDir = join(process.env.DESIGN_STACK_DIR ?? 'D:/tmp/design', 'failed-shots');
const manifestFile = join(outDir, 'manifest.json');
const wanted = (entry) => options.only === null || options.only.has(entry.id);
const screens = options.screens ? SCREENS.filter(wanted) : [];
const clips = options.clips ? CLIPS.filter(wanted) : [];

const items = [];
const failures = [];
const warnings = [];
let dataPromise = null;
/** Passed to every screen / clip. `data()` prepares the demo data once per run, on first use. */
const shared = { data: () => (dataPromise ??= prepareData()) };

function describe(entry, session, extra) {
  const { viewport } = VIEWPORTS[session.def.viewport];
  return { id: entry.id, title: entry.title, group: entry.group, viewport: { name: session.def.viewport, ...viewport }, ...extra };
}

async function fail(entry, page, error) {
  const message = String(error?.message ?? error).split('\n')[0];
  failures.push({ id: entry.id, error: message });
  console.log(`✘ ${entry.id} — ${message}`);
  mkdirSync(failedDir, { recursive: true });
  await page.screenshot({ path: join(failedDir, `${entry.id}.png`) }).catch(() => undefined);
  await page.keyboard.press('Escape').catch(() => undefined);
}

async function shootScreen(session, screen) {
  const { page } = session;
  try {
    await page.emulateMedia({ colorScheme: 'light' });
    await screen.run(page, shared);
    for (const theme of screen.themes) {
      await page.emulateMedia({ colorScheme: theme });
      await pause(page, 350);
      const applied = await page.evaluate(() => document.documentElement.dataset.theme ?? null);
      if (screen.group !== 'kitchen' && applied !== null && applied !== theme) {
        warnings.push(`${screen.id}: wanted the ${theme} theme, the page shows ${applied}`);
      }
      const file = `${screen.id}--${theme}.png`;
      await page.screenshot({ path: join(outDir, file), fullPage: screen.fullPage === true, animations: 'disabled', caret: 'hide' });
      items.push(describe(screen, session, { kind: 'screenshot', theme, file }));
      console.log(`✔ ${file}`);
    }
    await page.emulateMedia({ colorScheme: 'light' });
    if (screen.cleanup) await screen.cleanup(page);
  } catch (error) {
    await fail(screen, page, error);
    await page.emulateMedia({ colorScheme: 'light' }).catch(() => undefined);
  }
}

async function recordClip(session, clip) {
  const { page } = session;
  const file = `${clip.id}.webm`;
  const target = join(outDir, file);
  let recorded = false;
  const record = async (interaction) => {
    rmSync(target, { force: true });
    await page.screencast.start({ path: target, size: VIEWPORTS[session.def.viewport].viewport });
    const started = Date.now();
    try {
      await interaction();
    } finally {
      shared.lastClipSeconds = Math.round((Date.now() - started) / 100) / 10;
      await page.screencast.stop();
      recorded = true;
    }
  };
  try {
    await page.emulateMedia({ colorScheme: 'light' });
    await clip.run(page, { ...shared, record });
    if (!recorded || !existsSync(target)) throw new Error('the clip recorded nothing');
    const theme = clip.group === 'kitchen' ? 'dark' : 'light';
    items.push(describe(clip, session, { kind: 'clip', theme, file, seconds: shared.lastClipSeconds }));
    console.log(`✔ ${file} (${shared.lastClipSeconds} s)`);
  } catch (error) {
    await fail(clip, page, error);
  }
}

/** A partial run (`--only`) keeps the other entries of an existing manifest. */
function writeManifest() {
  let kept = [];
  if (options.only !== null && existsSync(manifestFile)) {
    const done = new Set(items.map((item) => item.file));
    kept = JSON.parse(readFileSync(manifestFile, 'utf8')).items.filter((item) => !done.has(item.file));
  }
  const order = new Map([...SCREENS, ...CLIPS].map((entry, index) => [entry.id, index]));
  const all = [...kept, ...items].sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999) || a.file.localeCompare(b.file));
  const manifest = {
    label: options.label,
    capturedAt: new Date().toISOString(),
    urls: { admin: ADMIN_URL, landing: LANDING_URL, api: API_URL },
    items: all,
  };
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return all.length;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  // Signed-in screens show live data (dashboard counters, KDS, cashier): prepare it before the first shot.
  if ([...screens, ...clips].some((entry) => SESSIONS[entry.session].role)) {
    const data = await shared.data();
    console.log(`demo data ready (${data.createdOrders} order(s) created, cashier order #${data.payOrderNumber})`);
  }
  const browser = await chromium.launch({ headless: !options.headed });
  try {
    for (const name of Object.keys(SESSIONS)) {
      const sessionScreens = screens.filter((screen) => screen.session === name);
      const sessionClips = clips.filter((clip) => clip.session === name);
      if (sessionScreens.length + sessionClips.length === 0) continue;
      let session;
      try {
        session = await openSession(browser, name);
      } catch (error) {
        for (const entry of [...sessionScreens, ...sessionClips]) failures.push({ id: entry.id, error: `session ${name}: ${error.message.split('\n')[0]}` });
        console.log(`✘ session ${name} — ${error.message.split('\n')[0]}`);
        continue;
      }
      session.page.on('response', (response) => {
        if (response.status() === 429) warnings.push(`${name}: 429 from ${new URL(response.url()).pathname}`);
      });
      try {
        for (const screen of sessionScreens) await shootScreen(session, screen);
        for (const clip of sessionClips) await recordClip(session, clip);
      } finally {
        await session.close();
      }
    }
  } finally {
    await browser.close();
  }
  const total = writeManifest();
  for (const warning of new Set(warnings)) console.log(`! ${warning}`);
  console.log(`\n${items.length} file(s) written, manifest lists ${total}: ${outDir}`);
  if (failures.length > 0) {
    console.log(`${failures.length} failed (${failures.map((f) => f.id).join(', ')}); screenshots of the failures: ${failedDir}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
