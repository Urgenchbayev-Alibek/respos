import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { protocol } from 'electron';
import { SETTINGS_HOST, SHELL_SCHEME } from '../shared/ipc';

/**
 * CSP of the bundled connection page: only its own script and stylesheet, no inline code, no network access
 * of any kind (it talks to main over IPC only). The same policy is repeated in the page's <meta> tag.
 */
export const SETTINGS_PAGE_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

/** The complete set of files the scheme serves. Anything else is a 404 — there is no path → file mapping. */
const PAGE_FILES: Readonly<Record<string, { file: string; type: string }>> = Object.freeze({
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/settings.css': { file: 'settings.css', type: 'text/css; charset=utf-8' },
  '/settings.js': { file: 'settings.js', type: 'text/javascript; charset=utf-8' },
});

/** Must run before `app` is ready. `standard` gives the pages a real origin; `secure` makes it a secure context. */
export function registerShellScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: SHELL_SCHEME, privileges: { standard: true, secure: true } },
  ]);
}

/** Serves the bundled connection page from `uiDir` instead of `file://` (no file-system reach from a page). */
export function handleShellProtocol(uiDir: string): void {
  protocol.handle(SHELL_SCHEME, async (request) => {
    const url = new URL(request.url);
    const entry = url.host === SETTINGS_HOST ? PAGE_FILES[url.pathname] : undefined;
    if (request.method !== 'GET' || entry === undefined) {
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    const body = await readFile(path.join(uiDir, entry.file));
    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        'content-type': entry.type,
        'content-security-policy': SETTINGS_PAGE_CSP,
        'x-content-type-options': 'nosniff',
        'cache-control': 'no-store',
      },
    });
  });
}
