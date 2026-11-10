import { STORAGE_KEYS } from '@/shared/constants/locale';
import { safeStorage } from './safe-storage';

/**
 * Colour theme for admin/waiter/cashier/stock/platform. Stored per device (not per user).
 * `system` follows `prefers-color-scheme`. KDS ignores it (its shell sets `data-theme="kds"`, always dark).
 * The resolved value is written to `<html data-theme="light|dark">`; index.html applies it before first paint.
 */
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const listeners = new Set<() => void>();

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

export function getThemePreference(): ThemePreference {
  const stored = safeStorage.get(STORAGE_KEYS.theme);
  return isThemePreference(stored) ? stored : 'system';
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return preference;
}

/** Writes the resolved theme to `<html>` (and `color-scheme` for native controls). */
export function applyTheme(preference: ThemePreference = getThemePreference()): ResolvedTheme {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  return resolved;
}

export function setThemePreference(preference: ThemePreference): void {
  if (preference === 'system') safeStorage.remove(STORAGE_KEYS.theme);
  else safeStorage.set(STORAGE_KEYS.theme, preference);
  applyTheme(preference);
  listeners.forEach((listener) => listener());
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Applies the stored theme and follows OS changes while the preference is `system`. Call once at startup. */
export function initTheme(): void {
  applyTheme();
  if (typeof window.matchMedia !== 'function') return;
  window.matchMedia(DARK_QUERY).addEventListener('change', () => {
    if (getThemePreference() === 'system') applyTheme('system');
  });
}
