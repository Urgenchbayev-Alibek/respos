// Runs the smoke test against the PACKAGED app: node scripts/e2e-packaged.mjs [path/to/RestaurantOS.exe]
// Default exe: release/win-unpacked/RestaurantOS.exe (made by `npm run pack` or `npm run dist`).
// Set RESPOS_E2E_SERVER_URL to add the sign-in scenario against a real backend.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executable = path.resolve(process.argv[2] ?? path.join(root, 'release', 'win-unpacked', 'RestaurantOS.exe'));

if (!existsSync(executable)) {
  console.error(`The packaged app was not found: ${executable}\nBuild it first: npm run build:web && npm run pack`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [path.join(root, 'node_modules', 'vitest', 'vitest.mjs'), 'run', '--config', 'vitest.e2e.config.mts', 'e2e/packaged.e2e.ts'],
  { cwd: root, env: { ...process.env, RESPOS_E2E_PACKAGED_EXE: executable }, stdio: 'inherit' },
);
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
