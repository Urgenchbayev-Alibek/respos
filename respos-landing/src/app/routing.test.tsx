import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { jsonResponse, renderApp } from '@/test/renderApp';

describe('routing smoke', () => {
  it.each([
    ['/', 'Весь ресторан — в одной понятной системе'],
    ['/features', 'Возможности RestaurantOS'],
    ['/pricing', 'Тарифы'],
    ['/faq', 'Вопросы и ответы'],
    ['/contacts', 'Контакты'],
    ['/demo', 'Заявка на демонстрацию'],
    ['/privacy', 'Политика конфиденциальности'],
    ['/terms', 'Пользовательское соглашение'],
    ['/no-such-page', 'Страница не найдена'],
  ])('renders %s with its main heading', async (path, heading) => {
    renderApp(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('sets the page title per route', async () => {
    renderApp('/faq');
    await waitFor(() => expect(document.title).toBe('Вопросы и ответы — RestaurantOS'));
  });

  it('navigates via the header menu', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const nav = screen.getAllByRole('navigation', { name: 'Основная навигация' })[0]!;
    await user.click(within(nav).getByRole('link', { name: 'Тарифы' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Тарифы' })).toBeInTheDocument();
  });

  it('marks legal pages as drafts', () => {
    renderApp('/privacy');
    expect(screen.getByText('Черновик — требует юридической проверки')).toBeInTheDocument();
  });

  it('pricing shows "prices TBD" and falls back when /public/plans is unavailable', async () => {
    renderApp('/pricing');
    expect(screen.getAllByText('Цены уточняются')).toHaveLength(3);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByLabelText('Лимиты тарифа')).not.toBeInTheDocument();
  });

  it('pricing shows plan limits from the API when available', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse([{ code: 'starter', name: 'Starter', maxBranches: 1, maxUsers: 5, features: [] }], 200),
    );
    renderApp('/pricing');
    expect(await screen.findByText('1 филиал')).toBeInTheDocument();
    expect(screen.getByText('5 пользователей')).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toMatch(/\/public\/plans$/);
  });

  it('links "Войти" to the admin app', () => {
    renderApp('/');
    const login = screen.getAllByRole('link', { name: 'Войти' })[0];
    expect(login).toHaveAttribute('href', expect.stringMatching(/^https?:\/\//));
  });
});
