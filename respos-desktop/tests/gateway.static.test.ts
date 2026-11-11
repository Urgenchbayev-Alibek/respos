import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalGateway } from '../src/gateway/local-gateway';
import { isBrowserSafePort } from '../src/gateway/ports';
import { request } from './helpers/http-client';

const INLINE_SCRIPT = "document.documentElement.setAttribute('data-theme', 'light');";
const INDEX_HTML = [
  '<!doctype html>',
  '<html lang="ru"><head><meta charset="UTF-8" /><title>RestaurantOS</title>',
  `<script>${INLINE_SCRIPT}</script>`,
  '<script type="module" crossorigin src="/assets/index-4f3a9c1b.js"></script>',
  '</head><body><div id="root"></div></body></html>',
].join('\n');
const APP_JS = 'console.info("app");\n';
const SECRET = 'TOP-SECRET-OUTSIDE-ROOT';

let workDir: string;
let webDir: string;
let gateway: LocalGateway;
let port: number;

beforeAll(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), 'respos-gateway-static-'));
  webDir = path.join(workDir, 'web-dist');
  await mkdir(path.join(webDir, 'assets'), { recursive: true });
  await writeFile(path.join(webDir, 'index.html'), INDEX_HTML);
  await writeFile(path.join(webDir, 'assets', 'index-4f3a9c1b.js'), APP_JS);
  await writeFile(path.join(webDir, 'assets', 'index-9d2e.css'), 'body{margin:0}');
  await writeFile(path.join(webDir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await writeFile(path.join(webDir, 'manifest.webmanifest'), '{}');
  await writeFile(path.join(workDir, 'secret.txt'), SECRET);

  gateway = new LocalGateway({ staticDir: webDir, preferredPort: 0 });
  port = (await gateway.start()).port;
});

afterAll(async () => {
  await gateway.stop();
  await rm(workDir, { recursive: true, force: true });
});

describe('gateway: static web app', () => {
  it('serves index.html at the root, never cached', async () => {
    const response = await request(port, { path: '/' });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.text).toBe(INDEX_HTML);
  });

  it('falls back to index.html for application routes (SPA fallback)', async () => {
    for (const route of ['/kitchen', '/admin/menu/items/42?tab=prices', '/login#x', '/index.html']) {
      const response = await request(port, { path: route });
      expect(response.status, route).toBe(200);
      expect(response.text, route).toBe(INDEX_HTML);
      expect(response.headers['cache-control'], route).toBe('no-cache');
    }
  });

  it('sends a CSP that allows the inline bootstrap script by hash and websockets to itself only', async () => {
    const csp = String((await request(port, { path: '/' })).headers['content-security-policy'] ?? '');
    const hash = createHash('sha256').update(INLINE_SCRIPT, 'utf8').digest('base64');
    expect(csp).toContain(`script-src 'self' 'sha256-${hash}'`);
    expect(csp).toContain(`connect-src 'self' ws://127.0.0.1:${port} ws://localhost:${port}`);
    // Report "PDF / print" frames the server's print layout from a blob: URL.
    expect(csp).toContain("frame-src 'self' blob:");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp.split(';').find((part) => part.trim().startsWith('script-src'))).not.toContain("'unsafe-inline'");
  });

  it('serves hashed assets with their MIME type as immutable', async () => {
    const script = await request(port, { path: '/assets/index-4f3a9c1b.js' });
    expect(script.status).toBe(200);
    expect(script.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(script.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(script.headers['content-length']).toBe(String(Buffer.byteLength(APP_JS)));
    expect(script.text).toBe(APP_JS);

    const style = await request(port, { path: '/assets/index-9d2e.css' });
    expect(style.headers['content-type']).toBe('text/css; charset=utf-8');
  });

  it('serves other files with the right MIME type and revalidation', async () => {
    const icon = await request(port, { path: '/favicon.svg' });
    expect(icon.status).toBe(200);
    expect(icon.headers['content-type']).toBe('image/svg+xml');
    expect(icon.headers['cache-control']).toBe('no-cache');

    const manifest = await request(port, { path: '/manifest.webmanifest' });
    expect(manifest.headers['content-type']).toBe('application/manifest+json; charset=utf-8');
  });

  it('answers 304 when the ETag still matches', async () => {
    const first = await request(port, { path: '/favicon.svg' });
    const etag = first.headers.etag;
    expect(etag).toBeTruthy();
    const second = await request(port, { path: '/favicon.svg', headers: { 'if-none-match': etag } });
    expect(second.status).toBe(304);
    expect(second.body.length).toBe(0);
  });

  it('answers HEAD without a body', async () => {
    const response = await request(port, { method: 'HEAD', path: '/assets/index-4f3a9c1b.js' });
    expect(response.status).toBe(200);
    expect(response.headers['content-length']).toBe(String(Buffer.byteLength(APP_JS)));
    expect(response.body.length).toBe(0);
  });

  it('answers 404 for a missing asset instead of the SPA fallback', async () => {
    const response = await request(port, { path: '/assets/missing-123.js' });
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toBe('application/problem+json; charset=utf-8');
    expect(JSON.parse(response.text)).toMatchObject({ status: 404, code: 'desktop.not_found' });
  });

  it('never serves a file outside the web root (path traversal)', async () => {
    const attempts = [
      '/../secret.txt',
      '/..%2fsecret.txt',
      '/%2e%2e/secret.txt',
      '/%2e%2e%2fsecret.txt',
      '/assets/../../secret.txt',
      '/assets/%2e%2e/%2e%2e/secret.txt',
      '/assets/..%5c..%5csecret.txt',
      '/..%5csecret.txt',
      '/%5c..%5csecret.txt',
      `/${encodeURIComponent(path.join(workDir, 'secret.txt'))}`,
      '//secret.txt',
      '/assets/....//....//secret.txt',
    ];
    for (const attempt of attempts) {
      const response = await request(port, { path: attempt });
      expect(response.text, attempt).not.toContain(SECRET);
      expect([200, 400, 404], attempt).toContain(response.status);
      if (response.status === 200) expect(response.text, attempt).toBe(INDEX_HTML);
    }
  });

  it('rejects malformed percent-encoding and NUL bytes', async () => {
    expect((await request(port, { path: '/%E0%A4%A' })).status).toBe(400);
    expect((await request(port, { path: '/assets/a%00.js' })).status).toBe(400);
  });

  it('allows only GET and HEAD on static paths', async () => {
    const response = await request(port, { method: 'POST', path: '/', body: 'x' });
    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe('GET, HEAD');
  });
});

describe('gateway: host and origin guards', () => {
  it('answers 403 when addressed by any other host name (DNS rebinding)', async () => {
    for (const host of ['evil.example', `evil.example:${port}`, `127.0.0.1:${port + 1}`, '127.0.0.1', `192.168.1.5:${port}`]) {
      const response = await request(port, { path: '/', headers: { host } });
      expect(response.status, host).toBe(403);
      expect(JSON.parse(response.text), host).toEqual({ status: 403, code: 'desktop.forbidden_host', title: 'Forbidden host' });
    }
  });

  it('accepts 127.0.0.1 and localhost with the gateway port', async () => {
    expect((await request(port, { path: '/', headers: { host: `127.0.0.1:${port}` } })).status).toBe(200);
    expect((await request(port, { path: '/', headers: { host: `LOCALHOST:${port}` } })).status).toBe(200);
  });

  it('answers 403 to requests that carry a foreign Origin', async () => {
    for (const origin of ['https://evil.example', 'null', `http://127.0.0.1:${port + 1}`, `https://127.0.0.1:${port}`]) {
      const response = await request(port, { path: '/api/v1/echo', headers: { origin } });
      expect(response.status, origin).toBe(403);
      expect(JSON.parse(response.text), origin).toMatchObject({ code: 'desktop.forbidden_origin' });
    }
    const own = await request(port, { path: '/', headers: { origin: `http://127.0.0.1:${port}` } });
    expect(own.status).toBe(200);
  });

  it('refuses absolute-form request targets', async () => {
    const response = await request(port, { path: 'http://example.com/api/v1/echo' });
    expect(response.status).toBe(400);
  });
});

describe('gateway: without a built web app', () => {
  it('serves the built-in placeholder page', async () => {
    const empty = new LocalGateway({ staticDir: path.join(workDir, 'does-not-exist'), preferredPort: 0 });
    const emptyPort = (await empty.start()).port;
    try {
      const page = await request(emptyPort, { path: '/' });
      expect(page.status).toBe(200);
      expect(page.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(page.text).toContain('data-testid="desktop-placeholder"');
      expect(page.headers['content-security-policy']).toContain("script-src 'self';");
      expect((await request(emptyPort, { path: '/login' })).text).toContain('desktop-placeholder');
      expect((await request(emptyPort, { path: '/assets/app.js' })).status).toBe(404);
    } finally {
      await empty.stop();
    }
  });

  it('serves the placeholder when no folder is configured at all', async () => {
    const none = new LocalGateway({ staticDir: null, preferredPort: 0 });
    const nonePort = (await none.start()).port;
    try {
      expect((await request(nonePort, { path: '/' })).text).toContain('desktop-placeholder');
    } finally {
      await none.stop();
    }
  });
});

describe('gateway: port selection', () => {
  it('falls back to a free port when the preferred one is taken', async () => {
    const second = new LocalGateway({ staticDir: webDir, preferredPort: port });
    const info = await second.start();
    try {
      expect(info.usedFallbackPort).toBe(true);
      expect(info.port).not.toBe(port);
      expect(info.origin).toBe(`http://127.0.0.1:${info.port}`);
      expect((await request(info.port, { path: '/' })).status).toBe(200);
    } finally {
      await second.stop();
    }
  });

  it('reports its origin on the loopback address', () => {
    expect(gateway.origin).toBe(`http://127.0.0.1:${port}`);
  });

  it('never listens on a port the renderer refuses to load from (ERR_UNSAFE_PORT)', async () => {
    expect(isBrowserSafePort(47615)).toBe(true);
    for (const blocked of [1723, 6000, 5060, 10080, 0, 70_000]) expect(isBrowserSafePort(blocked), String(blocked)).toBe(false);

    const blockedPreference = new LocalGateway({ staticDir: webDir, preferredPort: 6000 });
    const info = await blockedPreference.start();
    try {
      expect(info.usedFallbackPort).toBe(true);
      expect(isBrowserSafePort(info.port)).toBe(true);
    } finally {
      await blockedPreference.stop();
    }
    expect(isBrowserSafePort(port)).toBe(true);
  });
});
