import { createHash } from 'node:crypto';
import { createReadStream, type Stats } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { mimeTypeFor } from './mime';
import { PLACEHOLDER_HTML } from './placeholder';
import { BAD_REQUEST, METHOD_NOT_ALLOWED, NOT_FOUND, sendProblem } from './problem';

export interface StaticContext {
  /** Folder with the built web app (`web-dist`); `null` or a folder without index.html → placeholder page. */
  rootDir: string | null;
  /** Port the gateway listens on (the web app's own origin, used in the Content-Security-Policy). */
  port: number;
}

const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
});

const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';
const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

interface IndexDocument {
  version: string;
  body: Buffer;
  csp: string;
}

let cachedIndex: { file: string; port: number; document: IndexDocument } | null = null;

function etagFor(stats: Stats): string {
  return `W/"${stats.size.toString(16)}-${Math.trunc(stats.mtimeMs).toString(16)}"`;
}

/**
 * CSP for the web app document: everything same-origin (API, hubs and files are proxied under the gateway
 * origin). Inline scripts of the built index.html (the theme bootstrap) are allowed by hash, never by
 * 'unsafe-inline'. Images may also come from data:/blob: (QR codes, upload previews) and http(s) storage URLs.
 * A blob: document inherits this policy, so a framed print layout cannot run scripts either.
 */
export function buildContentSecurityPolicy(html: string, port: number): string {
  const hashes: string[] = [];
  for (const match of html.matchAll(INLINE_SCRIPT)) {
    const attributes = match[1] ?? '';
    const source = match[2] ?? '';
    if (/\bsrc\s*=/i.test(attributes) || source.trim() === '') continue;
    // The HTML parser normalizes newlines before the script text is hashed by the browser.
    const normalized = source.replace(/\r\n?/g, '\n');
    hashes.push(`'sha256-${createHash('sha256').update(normalized, 'utf8').digest('base64')}'`);
  }
  return [
    "default-src 'self'",
    ["script-src 'self'", ...hashes].join(' '),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    "media-src 'self' data: blob:",
    `connect-src 'self' ws://127.0.0.1:${port} ws://localhost:${port}`,
    "worker-src 'self' blob:",
    // Report "PDF / print": the server's print layout is shown in a hidden blob: iframe and printed from there.
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

async function loadIndex(ctx: StaticContext): Promise<IndexDocument | null> {
  if (ctx.rootDir === null) return null;
  const file = path.join(ctx.rootDir, 'index.html');
  const stats = await stat(file).catch(() => null);
  if (!stats?.isFile()) return null;
  const version = etagFor(stats);
  if (cachedIndex?.file === file && cachedIndex.port === ctx.port && cachedIndex.document.version === version) {
    return cachedIndex.document;
  }
  const body = await readFile(file);
  const document = { version, body, csp: buildContentSecurityPolicy(body.toString('utf8'), ctx.port) };
  cachedIndex = { file, port: ctx.port, document };
  return document;
}

type Resolution = { kind: 'bad' } | { kind: 'index' } | { kind: 'none' } | { kind: 'file'; file: string };

/** Maps a request path onto a file inside `rootDir`. Never returns a path outside of it. */
export function resolveStaticPath(rootDir: string, pathname: string): Resolution {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { kind: 'bad' };
  }
  if (decoded.includes('\0')) return { kind: 'bad' };
  // Backslashes, drive letters, UNC prefixes and NTFS stream names never address a bundled file.
  if (decoded.includes('\\') || decoded.includes(':')) return { kind: 'none' };
  const normalized = path.posix.normalize(decoded.startsWith('/') ? decoded : `/${decoded}`);
  // NTFS ignores letter case: every spelling of the document must get the document's headers (CSP).
  if (normalized === '/' || normalized.toLowerCase() === '/index.html') return { kind: 'index' };
  // Windows ignores trailing dots and spaces in names: refuse them so a file has exactly one URL.
  if (normalized.split('/').some((segment) => segment === '..' || /[. ]$/.test(segment))) return { kind: 'none' };

  const root = path.resolve(rootDir);
  const file = path.resolve(root, `.${normalized}`);
  if (!file.startsWith(root + path.sep)) return { kind: 'none' };
  return { kind: 'file', file };
}

function isAssetRequest(pathname: string): boolean {
  return path.posix.extname(pathname.slice(pathname.lastIndexOf('/') + 1)) !== '';
}

function isFresh(req: IncomingMessage, etag: string): boolean {
  const header = req.headers['if-none-match'];
  return header !== undefined && header.split(',').some((candidate) => candidate.trim() === etag);
}

function sendDocument(req: IncomingMessage, res: ServerResponse, body: Buffer, csp: string, etag?: string): void {
  const headers: Record<string, string | number> = {
    ...SECURITY_HEADERS,
    'Content-Type': mimeTypeFor('.html'),
    'Cache-Control': REVALIDATE,
    'Content-Security-Policy': csp,
  };
  if (etag !== undefined) headers.ETag = etag;
  if (etag !== undefined && isFresh(req, etag)) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

async function sendFile(req: IncomingMessage, res: ServerResponse, file: string, stats: Stats, pathname: string): Promise<void> {
  const etag = etagFor(stats);
  const headers: Record<string, string | number> = {
    ...SECURITY_HEADERS,
    'Content-Type': mimeTypeFor(path.extname(file)),
    'Cache-Control': pathname.startsWith('/assets/') ? IMMUTABLE : REVALIDATE,
    ETag: etag,
    'Last-Modified': stats.mtime.toUTCString(),
  };
  if (isFresh(req, etag)) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  headers['Content-Length'] = stats.size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  try {
    await pipeline(createReadStream(file), res);
  } catch {
    // The file vanished or the renderer went away mid-stream; the head is out, so just drop the connection.
    res.destroy();
  }
}

/**
 * Serves the bundled web app: real files with their MIME type, hashed `/assets/*` as immutable, and
 * `index.html` (never cached) for every route-like path — the SPA fallback. Without a bundle a built-in
 * placeholder page is served instead.
 */
export async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  ctx: StaticContext,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendProblem(res, METHOD_NOT_ALLOWED, { Allow: 'GET, HEAD' });
    return;
  }
  const resolution: Resolution = ctx.rootDir === null ? { kind: 'none' } : resolveStaticPath(ctx.rootDir, pathname);
  if (resolution.kind === 'bad') {
    sendProblem(res, BAD_REQUEST);
    return;
  }
  if (resolution.kind === 'file') {
    const stats = await stat(resolution.file).catch(() => null);
    if (stats?.isFile()) {
      await sendFile(req, res, resolution.file, stats, pathname);
      return;
    }
  }
  if (resolution.kind !== 'index' && isAssetRequest(pathname)) {
    sendProblem(res, NOT_FOUND);
    return;
  }
  const index = await loadIndex(ctx);
  if (index) sendDocument(req, res, index.body, index.csp, index.version);
  else sendDocument(req, res, PLACEHOLDER_HTML, buildContentSecurityPolicy('', ctx.port));
}
