import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/shared/constants/locale';
import { applyTheme, getThemePreference } from '@/shared/lib/theme';
import { renderWithProviders } from '@/test/test-utils';
import { UserMenu } from './UserMenu';

describe('UserMenu theme toggle', () => {
  afterEach(() => applyTheme('light'));

  it('persists the choice per device and applies data-theme on <html>', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserMenu />);

    await user.click(screen.getByRole('button', { name: 'Меню пользователя' }));
    await user.click(screen.getByRole('menuitem', { name: 'Тема: тёмная' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark');
    expect(getThemePreference()).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Меню пользователя' }));
    expect(screen.getByRole('menuitem', { name: 'Тема: тёмная' })).toHaveAttribute('aria-current', 'true');
    await user.click(screen.getByRole('menuitem', { name: 'Тема: светлая' }));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('light');
  });

  it('"system" clears the stored choice and follows prefers-color-scheme', async () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'dark');
    const user = userEvent.setup();
    renderWithProviders(<UserMenu />);

    await user.click(screen.getByRole('button', { name: 'Меню пользователя' }));
    await user.click(screen.getByRole('menuitem', { name: 'Тема: как в системе' }));

    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBeNull();
    // The jsdom matchMedia stub reports a light system theme.
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('hides theme items on KDS', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserMenu showTheme={false} />);
    await user.click(screen.getByRole('button', { name: 'Меню пользователя' }));
    expect(screen.queryByRole('menuitem', { name: /Тема/ })).not.toBeInTheDocument();
  });
});
