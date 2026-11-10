import { useCallback, useSyncExternalStore } from 'react';
import { getThemePreference, setThemePreference, subscribeTheme, type ThemePreference } from '@/shared/lib/theme';

/** Current theme preference (system/light/dark) + setter; persisted per device. */
export function useTheme(): { preference: ThemePreference; setPreference: (next: ThemePreference) => void } {
  const preference = useSyncExternalStore(subscribeTheme, getThemePreference, getThemePreference);
  const setPreference = useCallback((next: ThemePreference) => setThemePreference(next), []);
  return { preference, setPreference };
}
