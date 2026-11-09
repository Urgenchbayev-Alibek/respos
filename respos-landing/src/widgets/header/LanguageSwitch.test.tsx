import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LANGUAGE_STORAGE_KEY } from '@/shared/i18n';
import { renderApp } from '@/test/renderApp';

describe('language switch', () => {
  it('switches the site from Russian to Uzbek and back', async () => {
    const user = userEvent.setup();
    renderApp('/');

    expect(screen.getByRole('heading', { level: 1, name: 'Весь ресторан — в одной понятной системе' })).toBeInTheDocument();
    const [uzButton] = screen.getAllByRole('button', { name: 'Oʻzbekcha' });
    expect(uzButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(uzButton!);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Butun restoran — bitta tushunarli tizimda' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Tariflar' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Oʻzbekcha' })[0]).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.lang).toBe('uz-Latn');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('uz');

    await user.click(screen.getAllByRole('button', { name: 'Русский' })[0]!);
    expect((await screen.findAllByRole('link', { name: 'Тарифы' })).length).toBeGreaterThan(0);
    expect(document.documentElement.lang).toBe('ru');
  });
});
