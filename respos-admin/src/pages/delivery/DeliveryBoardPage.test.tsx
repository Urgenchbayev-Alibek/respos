import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DeliveryOrderDto } from '@/entities/delivery/delivery.types';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { DeliveryBoardPage } from './DeliveryBoardPage';

vi.mock('@/shared/realtime', () => ({ useRealtimeEvent: () => undefined }));

function delivery(overrides: Partial<DeliveryOrderDto> = {}): DeliveryOrderDto {
  return {
    orderId: 'o1',
    orderNumber: 7,
    displayNumber: '#0007',
    orderStatus: 'draft',
    status: 'new',
    allowedTransitions: ['accepted', 'cancelled'],
    customerName: 'Алишер',
    customerPhone: '+998901234567',
    address: 'ул. Навои, 5',
    entrance: '2',
    floor: null,
    apartment: '14',
    comment: null,
    courier: null,
    items: [{ id: 'i1', name: 'Плов', variantName: null, quantity: 2, status: 'new', lineTotal: 90000 }],
    subtotal: 90000,
    discountAmount: 0,
    deliveryFee: 12000,
    total: 102000,
    paidAmount: 0,
    remainingAmount: 102000,
    createdAt: new Date().toISOString(),
    statusChangedAt: new Date(Date.now() - 45 * 60_000).toISOString(),
    acceptedAt: null,
    cookingAt: null,
    readyAt: null,
    onTheWayAt: null,
    deliveredAt: null,
    cancelledAt: null,
    cancelReason: null,
    ...overrides,
  };
}

function mockBoard(items: DeliveryOrderDto[]) {
  server.use(
    http.get(api('/delivery/orders'), () => HttpResponse.json(items)),
    http.get(api('/delivery/couriers'), () => HttpResponse.json([{ id: 'c1', name: 'Бобур', phone: '+998901112233', isActive: true }])),
  );
}

describe('DeliveryBoardPage', () => {
  it('shows cards in status columns with phone link, fee and a late timer', async () => {
    mockBoard([delivery(), delivery({ orderId: 'o2', displayNumber: '#0008', status: 'delivered', allowedTransitions: [] })]);
    renderWithProviders(<DeliveryBoardPage />, { auth: makeAuth(makeUser({ permissions: ['delivery.read'] })) });

    const newColumn = await screen.findByRole('region', { name: 'Новые' });
    const card = within(newColumn).getByRole('article', { name: 'Доставка #0007' });
    expect(within(card).getByRole('link', { name: /\+998901234567/ })).toHaveAttribute('href', 'tel:+998901234567');
    expect(within(card).getByText('ул. Навои, 5, подъезд 2, кв. 14')).toBeInTheDocument();
    expect(within(card).getByText('45 мин')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Завершены' })).getByText('#0008')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Принять' })).not.toBeInTheDocument();
  });

  it('managers move a delivery to the next status', async () => {
    mockBoard([delivery()]);
    let body: unknown = null;
    server.use(
      http.post(api('/delivery/orders/o1/status'), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(delivery({ status: 'accepted', allowedTransitions: ['cooking', 'ready', 'cancelled'] }));
      }),
    );
    renderWithProviders(<DeliveryBoardPage />, { auth: makeAuth(makeUser({ permissions: ['delivery.read', 'delivery.manage'] })) });

    await userEvent.click(await screen.findByRole('button', { name: 'Принять' }));

    await waitFor(() => expect(body).toEqual({ status: 'accepted' }));
    expect(screen.getByRole('button', { name: 'Новая доставка' })).toBeInTheDocument();
  });
});
