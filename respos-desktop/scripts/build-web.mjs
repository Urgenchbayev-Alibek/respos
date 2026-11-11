// Builds ../respos-admin for the desktop shell and copies the result to web-dist/.
// The web app is built same-origin: API and hub URLs are root-relative and resolved against the gateway origin.
// Usage: node scripts/build-web.mjs   (set VITE_LANDING_URL to the public landing site for QR-menu links)
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminDir = path.resolve(root, '..', 'respos-admin');
const adminDist = path.join(adminDir, 'dist');
const webDist = path.join(root, 'web-dist');

function run(commandLine, env) {
  // npm is a .cmd shim on Windows, which Node only starts through a shell. The command line is a constant of
  // this script (never user input), passed as one string: Node deprecates an argument list together with a shell.
  const result = spawnSync(commandLine, { cwd: adminDir, env, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`"${commandLine}" failed in ${adminDir}`);
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(path.join(adminDir, 'package.json'))) {
  console.error(`respos-admin was not found at ${adminDir}`);
  process.exit(1);
}

const env = {
  ...process.env,
  VITE_DESKTOP: 'true',
  VITE_API_BASE_URL: '/api/v1',
  VITE_HUB_URL: '/hubs/restaurant',
  VITE_APP_ENV: 'production',
};
// The landing address is baked into the table QR codes: a build without it would print cards that open
// http://localhost:5174 on a guest's phone. RESPOS_DESKTOP_ALLOW_DEV_LANDING=1 is the opt-out for local test builds.
const landing = env.VITE_LANDING_URL ?? '';
const devLanding = landing === '' || /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(landing);
if (devLanding && env.RESPOS_DESKTOP_ALLOW_DEV_LANDING !== '1') {
  console.error(
    'VITE_LANDING_URL must be the public address of the QR-menu site (for example https://respos-landing.vercel.app).\n' +
      'For a local test build set RESPOS_DESKTOP_ALLOW_DEV_LANDING=1.',
  );
  process.exit(1);
}

if (!existsSync(path.join(adminDir, 'node_modules'))) run('npm ci', process.env);
run('npm run build', env);

if (!existsSync(path.join(adminDist, 'index.html'))) {
  console.error(`The web build produced no index.html in ${adminDist}`);
  process.exit(1);
}

await rm(webDist, { recursive: true, force: true });
// Source maps stay out of the installer: they are large and the packaged app has DevTools disabled.
await cp(adminDist, webDist, { recursive: true, filter: (source) => !source.endsWith('.map') });
console.info(`web-dist is ready: ${webDist}`);
