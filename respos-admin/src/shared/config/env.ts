import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url().default('http://localhost:5080/api/v1'),
  VITE_HUB_URL: z.string().url().default('http://localhost:5080/hubs/restaurant'),
  VITE_LANDING_URL: z.string().url().default('http://localhost:5174'),
  VITE_APP_ENV: z.enum(['development', 'preview', 'production', 'test']).default('development'),
});

function readEnv() {
  const parsed = envSchema.safeParse({
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || undefined,
    VITE_HUB_URL: import.meta.env.VITE_HUB_URL || undefined,
    VITE_LANDING_URL: import.meta.env.VITE_LANDING_URL || undefined,
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  return parsed.data;
}

const raw = readEnv();

/** Validated public runtime config. Contains NO secrets (VITE_* is visible in the browser). */
export const env = Object.freeze({
  apiBaseUrl: raw.VITE_API_BASE_URL.replace(/\/+$/, ''),
  hubUrl: raw.VITE_HUB_URL,
  /** Public landing (QR menu links `/menu/{slug}?table=N`). */
  landingUrl: raw.VITE_LANDING_URL.replace(/\/+$/, ''),
  appEnv: raw.VITE_APP_ENV,
  isProduction: raw.VITE_APP_ENV === 'production',
});
