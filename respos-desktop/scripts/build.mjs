// Bundles the shell into dist/: main process, the two preload scripts and the connection window page.
// Usage: node scripts/build.mjs
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const from = (...segments) => path.join(root, ...segments);

/** Electron 45.2 = Node 24 + Chromium 156; nothing is down-levelled below what it runs natively. */
const NODE_TARGET = 'node24';
const CHROMIUM_TARGET = 'chrome156';

const common = {
  bundle: true,
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'info',
  absWorkingDir: root,
};

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'settings'), { recursive: true });

await Promise.all([
  // Main process: one CommonJS file; `electron` is provided by the runtime, there are no other dependencies.
  build({
    ...common,
    entryPoints: [from('src/main/main.ts')],
    outfile: path.join(dist, 'main', 'main.js'),
    platform: 'node',
    format: 'cjs',
    target: NODE_TARGET,
    external: ['electron'],
  }),
  // Preloads run sandboxed: a single file each, no Node built-ins (the browser platform makes esbuild refuse them).
  build({
    ...common,
    entryPoints: [from('src/preload/app-preload.ts'), from('src/preload/settings-preload.ts')],
    outdir: path.join(dist, 'preload'),
    platform: 'browser',
    format: 'cjs',
    target: CHROMIUM_TARGET,
    external: ['electron'],
  }),
  // Connection window script: a classic script, allowed by `script-src 'self'`.
  build({
    ...common,
    entryPoints: [from('src/settings-ui/settings.ts')],
    outfile: path.join(dist, 'settings', 'settings.js'),
    platform: 'browser',
    format: 'iife',
    target: CHROMIUM_TARGET,
  }),
  cp(from('src/settings-ui/index.html'), path.join(dist, 'settings', 'index.html')),
  cp(from('src/settings-ui/settings.css'), path.join(dist, 'settings', 'settings.css')),
]);
