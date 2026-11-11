import type { IncomingHttpHeaders, OutgoingHttpHeaders } from 'node:http';

/** Headers that describe one connection and must not travel across a proxy hop (RFC 9110 §7.6.1). */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/** The hop to the backend is not a browser: these would only trip CORS / origin checks there. */
const BROWSER_ONLY = new Set(['origin', 'referer']);

function connectionTokens(value: string | string[] | undefined): Set<string> {
  const joined = Array.isArray(value) ? value.join(',') : (value ?? '');
  const tokens = new Set<string>();
  for (const token of joined.split(',')) {
    const name = token.trim().toLowerCase();
    if (name !== '') tokens.add(name);
  }
  return tokens;
}

/** Request headers for the backend: hop-by-hop and browser-only headers dropped, `Host` set to the backend. */
export function buildUpstreamHeaders(incoming: IncomingHttpHeaders, upstreamHost: string): OutgoingHttpHeaders {
  const listed = connectionTokens(incoming.connection);
  const headers: OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    if (name === 'host' || HOP_BY_HOP.has(name) || BROWSER_ONLY.has(name) || listed.has(name)) continue;
    headers[name] = value;
  }
  headers.host = upstreamHost;
  return headers;
}

/**
 * The loopback hop is plain http and has its own host name, so a cookie issued for the backend has to lose
 * `Secure` and `Domain` (and `Partitioned`, which requires `Secure`) to be stored for the gateway origin.
 * `SameSite` is forced to `Lax`: the web app and the API are same-origin here. Everything else is kept.
 */
export function rewriteSetCookie(cookie: string): string {
  const [pair = '', ...attributes] = cookie.split(';');
  const kept = attributes
    .map((attribute) => attribute.trim())
    .filter((attribute) => {
      if (attribute === '') return false;
      const name = attribute.split('=', 1)[0]?.trim().toLowerCase();
      return name !== 'secure' && name !== 'domain' && name !== 'samesite' && name !== 'partitioned';
    });
  return [pair.trim(), ...kept, 'SameSite=Lax'].join('; ');
}

/** A redirect to the backend's own origin must stay inside the gateway origin. Other targets are untouched. */
export function rewriteLocation(location: string, upstreamOrigin: string): string {
  if (location === upstreamOrigin) return '/';
  for (const boundary of ['/', '?', '#']) {
    if (location.startsWith(upstreamOrigin + boundary)) {
      const rest = location.slice(upstreamOrigin.length);
      return rest.startsWith('/') ? rest : `/${rest}`;
    }
  }
  return location;
}

/**
 * Response headers for the renderer, in `rawHeaders` layout (name, value, name, value …) so repeated headers
 * such as `Set-Cookie` and the original casing survive.
 */
export function buildDownstreamHeaders(rawHeaders: readonly string[], upstreamOrigin: string): string[] {
  const listed = new Set<string>();
  for (let index = 0; index + 1 < rawHeaders.length; index += 2) {
    if (rawHeaders[index]?.toLowerCase() === 'connection') {
      for (const token of connectionTokens(rawHeaders[index + 1])) listed.add(token);
    }
  }
  const headers: string[] = [];
  for (let index = 0; index + 1 < rawHeaders.length; index += 2) {
    const name = rawHeaders[index] ?? '';
    const value = rawHeaders[index + 1] ?? '';
    const lower = name.toLowerCase();
    if (HOP_BY_HOP.has(lower) || listed.has(lower)) continue;
    if (lower === 'set-cookie') headers.push(name, rewriteSetCookie(value));
    else if (lower === 'location') headers.push(name, rewriteLocation(value, upstreamOrigin));
    else headers.push(name, value);
  }
  return headers;
}

/** DNS-rebinding guard: the gateway answers only when it is addressed as the loopback host it listens on. */
export function isAllowedHost(hostHeader: string | undefined, port: number): boolean {
  if (hostHeader === undefined) return false;
  const host = hostHeader.trim().toLowerCase();
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

/**
 * Requests that carry an `Origin` must come from the gateway origin itself. Pages opened in some other browser
 * on this machine therefore cannot drive the proxy (cross-site requests, WebSocket hijacking).
 */
export function isAllowedOrigin(originHeader: string | undefined, port: number): boolean {
  if (originHeader === undefined) return true;
  const origin = originHeader.trim().toLowerCase();
  return origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
}

/** What a log line may say about a request: the path only. The query can carry tokens (`access_token` of the hub). */
export function pathForLog(url: string | undefined): string {
  return (url ?? '').split(/[?#]/, 1)[0] ?? '';
}
