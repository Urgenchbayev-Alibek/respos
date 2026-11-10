import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/shared/constants/locale';
import { applyTheme, getThemePreference, resolveTheme, setThemePreference } from './theme';

describe('theme', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    applyTheme('light');
  });

  it('defaults to system and ignores garbage in storage', () => {
    expect(getThemePreference()).toBe('system');
    localStorage.setItem(STORAGE_KEYS.theme, 'purple');
    expect(getThemePreference()).toBe('system');
  });

  it('resolves system from prefers-color-scheme', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({ matches: query.includes('dark') }) as MediaQueryList);
    expect(resolveTheme('system')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });

  it('survives unavailable storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => setThemePreference('dark')).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
