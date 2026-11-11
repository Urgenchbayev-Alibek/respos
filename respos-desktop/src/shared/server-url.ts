/** Why a server address typed by the user was rejected. */
export type ServerUrlError = 'empty' | 'invalid' | 'unsupported_protocol' | 'credentials_not_allowed';

export type ServerUrlResult = { ok: true; url: string } | { ok: false; error: ServerUrlError };

const MAX_LENGTH = 2048;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Normalizes a backend address to its origin (`http://192.168.1.10:5080`, `https://api.example.uz`).
 * A missing scheme means plain http (LAN servers); path, query and fragment are dropped because the gateway
 * always maps `/api`, `/hubs`, `/files`, `/health` onto the server root. Credentials in the URL are refused:
 * the settings file must never hold secrets.
 */
export function normalizeServerUrl(input: string): ServerUrlResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false, error: 'empty' };
  if (trimmed.length > MAX_LENGTH || /\s/.test(trimmed)) return { ok: false, error: 'invalid' };

  const candidate = HAS_SCHEME.test(trimmed) ? trimmed : `http://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'unsupported_protocol' };
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return { ok: false, error: 'credentials_not_allowed' };
  }
  if (parsed.hostname === '') return { ok: false, error: 'invalid' };
  return { ok: true, url: parsed.origin };
}
