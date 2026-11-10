import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CustomerListItemDto } from '@/entities/customer/customer.types';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { CustomersPage } from './CustomersPage';
import { LoyaltySettingsPage } from './LoyaltySettingsPage';

const row: CustomerListItemDto = {
  id: 'c1',
  name: 'Малика',
  phone: '+998937654321',
  birthday: '1990-11-12',
  tags: ['vip'],
  isVip: true,
  isBirthdayToday: false,
  isBirthdaySoon: true,
  visits: 3,
  totalSpent: 135000,
  averageCheck: 45000,
  lastVisitAt: '2026-11-09T12:00:00Z',
  points: 6750,
  createdAt: '2026-10-01T10:00:00Z',
};

describe('CustomersPage', () => {
  it('lists guests with stats and filters by segment', async () => {
    const segments: (string | null)[] = [];
    server.use(
      http.get(api('/customers'), ({ request }) => {
        const segment = new URL(request.url).searchParams.get('segment');
        segments.push(segment);
        const items = segment === 'sleeping' ? [] : [row];
        return HttpResponse.json({ items, page: 1, pageSize: 20, totalCount: items.length });
      }),
    );
    const auth = makeAuth(makeUser({ permissions: ['customers.read'] }));
    renderWithProviders(<CustomersPage />, { auth });
    const user = userEvent.setup();

    expect(await screen.findByText('Малика')).toBeInTheDocument();
    expect(screen.getByText('+998937654321')).toBeInTheDocument();
    expect(screen.getByText(/Скоро день рождения/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Добавить гостя' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Спящие (>30 дней)' }));
    expect(await screen.findByText('Гостей пока нет')).toBeInTheDocument();
    await waitFor(() => expect(segments).toContain('sleeping'));
  });
});

describe('LoyaltySettingsPage', () => {
  it('loads and saves the program settings', async () => {
    let saved: unknown = null;
    server.use(
      http.get(api('/loyalty/settings'), () =>
        HttpResponse.json({ isEnabled: false, earnPercent: 5, maxRedeemPercent: 30, minOrderAmount: 0, pointsExpiryDays: null }),
      ),
      http.put(api('/loyalty/settings'), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        saved = body;
        return HttpResponse.json(body);
      }),
    );
    const auth = makeAuth(makeUser({ permissions: ['customers.read', 'customers.manage'] }));
    renderWithProviders(<LoyaltySettingsPage />, { auth });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('switch'));
    const earn = screen.getByLabelText(/Начисление, %/);
    await user.clear(earn);
    await user.type(earn, '7');
    await user.type(screen.getByLabelText(/Срок жизни бонусов/), '90');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() =>
      expect(saved).toEqual({ isEnabled: true, earnPercent: 7, maxRedeemPercent: 30, minOrderAmount: 0, pointsExpiryDays: 90 }),
    );
    expect(await screen.findByText('Настройки сохранены')).toBeInTheDocument();
  });
});
