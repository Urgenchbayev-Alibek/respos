const trimSlash = (value: string): string => value.replace(/\/+$/, '');

/** Public runtime configuration. Only non-secret VITE_* values belong here. */
export const env = {
  apiBaseUrl: trimSlash(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5080/api/v1'),
  adminAppUrl: trimSlash(import.meta.env.VITE_ADMIN_APP_URL ?? 'http://localhost:5173'),
  /**
   * Public slug of the branch that receives online reservations (same slug as the QR menu `/menu/:slug`; not a secret).
   * Defaults to the demo branch `demo`; set it to an empty value to show the «not connected» notice.
   */
  publicBranchSlug: (import.meta.env.VITE_PUBLIC_BRANCH_SLUG ?? 'demo').trim().toLowerCase() || null,
} as const;
