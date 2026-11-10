import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CustomerListItemDto, OrderCustomerDto, OrderLoyaltyDto } from '@/entities/customer/customer.types';
import type { OrderDto } from '@/entities/order/order.types';
import { makeOrder } from '@/test/fixtures/floor-orders';
import { api, http, HttpResponse, problem, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { OrderGuestBar } from './OrderGuestBar';
import { RedeemPointsPanel } from './RedeemPointsPanel';

const guest: OrderCustomerDto = { id: 'c1', name: 'Азиз', phone: '+998901234567', isBirthdayToday: true, isVip: true, points: 4500 };

const listItem: CustomerListItemDto = {
  id: 'c1',
  name: 'Азиз',
  phone: '+998901234567',
  birthday: null,
  tags: ['vip'],
  isVip: true,
  isBirthdayToday: false,
  isBirthdaySoon: false,
  visits: 2,
  totalSpent: 90000,
  averageCheck: 45000,
  lastVisitAt: null,
  points: 4500,
  createdAt: '2026-11-01T10:00:00Z',
};

const order: OrderDto = makeOrder({ id: 'o1', status: 'served', subtotal: 45000, total: 45000, remainingAmount: 45000 });

describe('OrderGuestBar', () => {
  it('finds a guest by phone and attaches it to the order', async () => {
    let attachedWith: unknown = null;
    server.use(
      http.get(api('/customers'), ({ request }) => {
        expect(new URL(request.url).searchParams.get('search')).toBe('90123');
        return HttpResponse.json({ items: [listItem], page: 1, pageSize: 10, totalCount: 1 });
      }),
      http.post(api('/orders/o1/customer'), async ({ request }) => {
        attachedWith = await request.json();
        return HttpResponse.json({ ...order, customer: guest });
      }),
    );
    const auth = makeAuth(makeUser({ permissions: ['customers.read', 'orders.update'] }));
    renderWithProviders(<OrderGuestBar order={order} />, { auth });
    const user = userEvent.setup();

    expect(screen.getByText('Гость не выбран')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Новый гость' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Привязать гостя' }));
    await user.type(screen.getByPlaceholderText('Телефон или имя'), '90123');
    await user.click(await screen.findByRole('button', { name: 'Выбрать гостя Азиз' }));

    await waitFor(() => expect(attachedWith).toEqual({ customerId: 'c1' }));
  });

  it('shows birthday, VIP and points badges of the attached guest', () => {
    const auth = makeAuth(makeUser({ permissions: ['customers.read'] }));
    renderWithProviders(<OrderGuestBar order={{ ...order, customer: guest }} />, { auth });

    expect(screen.getByText('Азиз')).toBeInTheDocument();
    expect(screen.getByText(/День рождения сегодня/)).toBeInTheDocument();
    expect(screen.getByText(/VIP/)).toBeInTheDocument();
    expect(screen.getByText(/4.500 бонусов/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Сменить' })).not.toBeInTheDocument();
  });

  it('is hidden without customers.read', () => {
    const auth = makeAuth(makeUser({ permissions: ['orders.update'] }));
    const { container } = renderWithProviders(<OrderGuestBar order={order} />, { auth });
    expect(container).toBeEmptyDOMElement();
  });
});

describe('RedeemPointsPanel', () => {
  const loyalty: OrderLoyaltyDto = {
    isEnabled: true,
    customerId: 'c1',
    points: 4500,
    maxRedeemable: 2250,
    redeemed: 0,
    expectedEarn: 4500,
    minOrderAmount: 0,
    maxRedeemPercent: 5,
  };
  const auth = makeAuth(makeUser({ permissions: ['loyalty.redeem', 'payments.create'] }));

  it('redeems up to the server maximum and shows server errors', async () => {
    const sent: unknown[] = [];
    server.use(
      http.get(api('/orders/o1/loyalty'), () => HttpResponse.json(loyalty)),
      http.post(api('/orders/o1/loyalty/redeem'), async ({ request }) => {
        sent.push(await request.json());
        return sent.length === 1
          ? problem(422, 'loyalty.insufficient_points')
          : HttpResponse.json({ ...order, customer: guest, loyaltyDiscountAmount: 2250 });
      }),
    );
    renderWithProviders(<RedeemPointsPanel order={{ ...order, customer: guest }} />, { auth });
    const user = userEvent.setup();

    expect(await screen.findByText(/можно списать до 2.250/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Максимум' }));
    await user.click(screen.getByRole('button', { name: 'Списать' }));
    expect(await screen.findByText('У гостя недостаточно бонусов')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Максимум' }));
    await user.click(screen.getByRole('button', { name: 'Списать' }));

    await waitFor(() => expect(sent).toEqual([{ points: 2250 }, { points: 2250 }]));
  });

  it('renders nothing when the order has no guest', () => {
    const { container } = renderWithProviders(<RedeemPointsPanel order={order} />, { auth });
    expect(container).toBeEmptyDOMElement();
  });
});
