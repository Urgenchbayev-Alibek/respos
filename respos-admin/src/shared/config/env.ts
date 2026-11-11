import { z } from 'zod';

/**
 * Root-relative path (`/api/v1`): the API is served from the page's own origin — the desktop shell's loopback
 * gateway, or a same-origin reverse proxy. Protocol-relative values (`//host/...`) are not accepted.
 */
const ROOT_RELATIVE_PATH = /^\/(?!\/)/;
const HTTP_URL = /^https?:\/\//i;

/** http(s) only: a value like `C:/Program Files/Git/api/v1` (Git Bash rewriting `/api/v1`) must fail loudly. */
const serviceUrl = z.string().url().regex(HTTP_URL).or(z.string().regex(ROOT_RELATIVE_PATH));

const envSchema = z.object({
  VITE_API_BASE_URL: serviceUrl.default('http://localhost:5080/api/v1'),
  VITE_HUB_URL: serviceUrl.default('http://localhost:5080/hubs/restaurant'),
  VITE_LANDING_URL: z.string().url().default('http://localhost:5174'),
  VITE_APP_ENV: z.enum(['development', 'preview', 'production', 'test']).default('development'),
});

export type RawEnv = Partial<Record<keyof z.input<typeof envSchema>, string>>;

/** Root-relative values become absolute against the page origin, so every consumer can rely on `new URL(...)`. */
function toAbsoluteUrl(value: string, origin: string): string {
  if (!ROOT_RELATIVE_PATH.test(value)) return value;
  if (!HTTP_URL.test(origin)) {
    throw new Error(`Invalid environment configuration: "${value}" is relative, but the page origin "${origin}" is not http(s)`);
  }
  return new URL(value, origin).toString();
}

/** Validates the raw `VITE_*` values and resolves them for a page served from `origin`. */
export function resolveEnv(source: RawEnv, origin: string) {
  const parsed = envSchema.safeParse({
    VITE_API_BASE_URL: source.VITE_API_BASE_URL || undefined,
    VITE_HUB_URL: source.VITE_HUB_URL || undefined,
    VITE_LANDING_URL: source.VITE_LANDING_URL || undefined,
    VITE_APP_ENV: source.VITE_APP_ENV || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  const raw = parsed.data;
  return Object.freeze({
    apiBaseUrl: toAbsoluteUrl(raw.VITE_API_BASE_URL, origin).replace(/\/+$/, ''),
    hubUrl: toAbsoluteUrl(raw.VITE_HUB_URL, origin),
    /** Public landing (QR menu links `/menu/{slug}?table=N`). */
    landingUrl: raw.VITE_LANDING_URL.replace(/\/+$/, ''),
    appEnv: raw.VITE_APP_ENV,
    isProduction: raw.VITE_APP_ENV === 'production',
  });
}

/** Validated public runtime config. Contains NO secrets (VITE_* is visible in the browser). */
export const env = resolveEnv(
  {
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_HUB_URL: import.meta.env.VITE_HUB_URL,
    VITE_LANDING_URL: import.meta.env.VITE_LANDING_URL,
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
  },
  window.location.origin,
);
