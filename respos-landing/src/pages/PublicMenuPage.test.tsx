import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { PublicMenu } from '@/shared/api/publicMenuApi';
import { jsonResponse, renderApp } from '@/test/renderApp';

const menu: PublicMenu = {
  organizationName: 'Чайхана Навруз',
  currency: 'UZS',
  isDemo: false,
  branch: { slug: 'navruz', name: 'Центр', address: null, phone: null },
  categories: [
    {
      id: 'c1',
      name: 'Горячее',
      nameUz: 'Issiq taomlar',
      items: [
        { id: 'i1', name: 'Плов', nameUz: 'Osh', description: 'Ташкентский', photoUrl: '/files/menu/plov.jpg', price: 45000, variants: [] },
        {
          id: 'i2',
          name: 'Лагман',
          nameUz: null,
          description: null,
          photoUrl: null,
          price: 30000,
          variants: [
            { id: 'v1', name: '0.5', price: 18000 },
            { id: 'v2', name: '1', price: 30000 },
          ],
        },
      ],
    },
    { id: 'c2', name: 'Напитки', nameUz: 'Ichimliklar', items: [{ id: 'i3', name: 'Чай', nameUz: 'Choy', description: null, photoUrl: null, price: 8000, variants: [] }] },
  ],
};

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
const digits = (text: string | null) => (text ?? '').replace(/\D/g, '');

describe('PublicMenuPage', () => {
  it('renders categories, prices, photos and filters by search', async () => {
    vi.mocked(fetch).mockResolvedValue(ok(menu));
    renderApp('/menu/navruz');

    expect(await screen.findByRole('heading', { name: 'Горячее' })).toBeInTheDocument();
    expect(screen.getByText('Чайхана Навруз')).toBeInTheDocument();
    const plov = screen.getByRole('heading', { name: 'Плов' }).closest('li')!;
    expect(digits(within(plov).getByText(/45/).textContent)).toBe('45000');
    expect(plov.querySelector('img')).toHaveAttribute('src', 'http://localhost:5080/files/menu/plov.jpg');
    expect(screen.getByText(/^от /)).toBeInTheDocument();
    expect(String(vi.mocked(fetch).mock.calls[0]![0])).toBe('http://localhost:5080/api/v1/public/menu/navruz');
    expect(screen.queryByRole('button', { name: 'Позвать официанта' })).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('searchbox', { name: 'Поиск блюд' }), 'чай');
    expect(screen.queryByRole('heading', { name: 'Плов' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Чай' })).toBeInTheDocument();
  });

  it('switches names to Uzbek', async () => {
    vi.mocked(fetch).mockResolvedValue(ok(menu));
    renderApp('/menu/navruz');

    await screen.findByRole('heading', { name: 'Плов' });
    await userEvent.click(screen.getByRole('button', { name: /Oʻzbekcha/ }));

    expect(await screen.findByRole('heading', { name: 'Osh' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Issiq taomlar' })).toBeInTheDocument();
  });

  it('calls a waiter for the table from the QR link and reports rate limits', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok(menu))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'w1' }), { status: 202, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(jsonResponse({ status: 429, code: 'rate_limit.exceeded' }, 429));
    renderApp('/menu/navruz?table=7');

    expect(await screen.findByText('Стол 7')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Попросить счёт' }));
    expect(await screen.findByText('Счёт скоро принесут')).toBeInTheDocument();
    const [url, init] = vi.mocked(fetch).mock.calls[1]!;
    expect(String(url)).toBe('http://localhost:5080/api/v1/public/menu/navruz/call-waiter');
    expect(JSON.parse(String(init?.body))).toEqual({ tableNumber: '7', reason: 'bill' });

    await userEvent.click(screen.getByRole('button', { name: 'Позвать официанта' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Мы уже передали ваш вызов. Подождите минуту.'));
  });

  it('shows a friendly page for an unknown menu', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: 404, code: 'public_menu.not_found' }, 404));
    renderApp('/menu/missing');

    expect(await screen.findByRole('heading', { name: 'Меню не найдено' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', '/');
  });
});
