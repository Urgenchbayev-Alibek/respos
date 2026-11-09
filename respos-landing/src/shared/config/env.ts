const trimSlash = (value: string): string => value.replace(/\/+$/, '');

/** Public runtime configuration. Only non-secret VITE_* values belong here. */
export const env = {
  apiBaseUrl: trimSlash(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5080/api/v1'),
  adminAppUrl: trimSlash(import.meta.env.VITE_ADMIN_APP_URL ?? 'http://localhost:5173'),
} as const;
