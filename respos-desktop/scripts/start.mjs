// Starts the built shell with the local Electron binary: node scripts/start.mjs [electron/app arguments]
// Editors that are Electron apps themselves (VS Code and friends) export ELECTRON_RUN_AS_NODE=1 to the shells
// they spawn; with it Electron would run main.js as a plain Node script. It is dropped here.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electron = createRequire(import.meta.url)('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electron, [root, ...process.argv.slice(2)], { cwd: root, env, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
