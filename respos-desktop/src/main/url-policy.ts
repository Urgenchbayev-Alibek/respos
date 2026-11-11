import { SETTINGS_HOST, SHELL_SCHEME } from '../shared/ipc';

/**
 * URL classification behind the navigation, new-window and IPC rules. Pure functions (no Electron), so the
 * rules can be unit-tested.
 */

const MAX_EXTERNAL_URL_LENGTH = 2048;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function parse(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/** Origin of a URL for log lines (never the path or query: they may carry tokens). */
export function originForLog(raw: string): string {
  return parse(raw)?.origin ?? 'an invalid URL';
}

/** The page a web-app window may show: exactly the gateway origin (`blob:` URLs of that origin included). */
export function isGatewayUrl(raw: string, gatewayOrigin: string): boolean {
  const url = parse(raw);
  return url !== null && url.origin === gatewayOrigin;
}

/** `respos-shell://settings/...` — custom schemes have an opaque `origin`, so protocol and host are compared. */
export function isSettingsPageUrl(raw: string): boolean {
  const url = parse(raw);
  return url !== null && url.protocol === `${SHELL_SCHEME}:` && url.host === SETTINGS_HOST;
}

/**
 * Any spelling of the gateway's own address (`127.0.0.1`, `localhost`, either scheme). The gateway answers
 * under these names, so such a link is the app itself and must never be handed to another program.
 */
export function isGatewayAddress(raw: string, gatewayOrigin: string): boolean {
  const url = parse(raw);
  const gateway = parse(gatewayOrigin);
  if (url === null || gateway === null) return false;
  return LOOPBACK_HOSTS.has(url.hostname) && url.port !== '' && url.port === gateway.port;
}

/** Only plain web links leave the app, and only to the system browser. */
export function isSafeExternalUrl(raw: string, gatewayOrigin: string): boolean {
  if (raw.length > MAX_EXTERNAL_URL_LENGTH) return false;
  const url = parse(raw);
  if (!url) return false;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.username !== '' || url.password !== '') return false;
  return !isGatewayAddress(raw, gatewayOrigin);
}
