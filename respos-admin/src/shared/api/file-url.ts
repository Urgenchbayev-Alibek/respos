import { env } from '@/shared/config/env';

/** Already complete: has a scheme (`https:`, `blob:`, `data:`) or is protocol-relative (`//cdn/...`). */
const ABSOLUTE_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

/**
 * URL to render for a file returned by the API (`photoUrl`, …). The API stores files under its own origin and
 * returns root-relative paths (`/files/menu/x.jpg`), which a browser would resolve against the SPA origin — so they
 * are resolved against the API origin here. Absolute URLs (external storage, local `blob:` previews) pass through.
 */
export function resolveFileUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (ABSOLUTE_URL.test(url)) return url;
  return new URL(url.startsWith('/') ? url : `/${url}`, env.apiBaseUrl).toString();
}
