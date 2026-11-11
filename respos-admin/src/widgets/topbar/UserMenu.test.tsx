import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/shared/constants/locale';
import { applyTheme, getThemePreference } from '@/shared/lib/theme';
import type { ResposDesktopApi } from '@/shared/types/desktop';
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

describe('UserMenu connection settings (desktop shell only)', () => {
  function installDesktop(openConnectionSettings: ResposDesktopApi['openConnectionSettings']): void {
    window.resposDesktop = { isDesktop: true, appVersion: '1.0.0-test', openConnectionSettings, print: async () => ({ ok: true }) };
  }

  afterEach(() => {
    delete window.resposDesktop;
    vi.restoreAllMocks();
  });

  it('is not offered in a browser', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserMenu />);
    await user.click(screen.getByRole('button', { name: 'Меню пользователя' }));
    expect(screen.getByRole('menuitem', { name: 'Выйти' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Настройки подключения' })).not.toBeInTheDocument();
  });

  it('opens the native connection settings window in the desktop shell (KDS too)', async () => {
    const openConnectionSettings = vi.fn<ResposDesktopApi['openConnectionSettings']>(async () => undefined);
    installDesktop(openConnectionSettings);
    const user = userEvent.setup();
    renderWithProviders(<UserMenu showTheme={false} />);

    await user.click(screen.getByRole('button', { name: 'Меню пользователя' }));
    await user.click(screen.getByRole('menuitem', { name: 'Настройки подключения' }));

    expect(openConnectionSettings).toHaveBeenCalledTimes(1);
  });

  it('tells the user when the shell could not open them', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    installDesktop(() => Promise.reject(new Error('ipc closed')));
    const user = userEvent.setup();
    renderWithProviders(<UserMenu />);

    await user.click(screen.getByRole('button', { name: 'Меню пользователя' }));
    await user.click(screen.getByRole('menuitem', { name: 'Настройки подключения' }));

    expect(await screen.findByText('Не удалось открыть настройки подключения')).toBeInTheDocument();
  });
});
