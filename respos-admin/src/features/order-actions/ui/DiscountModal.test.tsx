import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeOrder } from '@/test/fixtures/floor-orders';
import { api, http, HttpResponse, problem, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { DiscountModal } from './DiscountModal';

const auth = makeAuth(makeUser({ permissions: ['orders.read', 'orders.discount.apply'] }));
const order = makeOrder({ status: 'served', subtotal: 100000, total: 100000, remainingAmount: 100000 });

/** Refetches triggered by invalidation after a successful mutation. */
function mockRefetches() {
  server.use(
    http.get(api('/orders/*'), () => HttpResponse.json(order)),
    http.get(api('/tables'), () => HttpResponse.json([])),
  );
}

describe('DiscountModal', () => {
  it('validates percent range and required reason before sending anything', async () => {
    let requests = 0;
    server.use(
      http.post(api('/orders/o1/discount'), () => {
        requests += 1;
        return HttpResponse.json(order);
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<DiscountModal order={order} onClose={vi.fn()} />, { auth });

    await user.type(screen.getByLabelText(/Процент/), '150');
    await user.click(screen.getByRole('button', { name: 'Применить' }));

    expect(await screen.findByText('Значение от 0 до 100')).toBeInTheDocument();
    expect(screen.getByText('Обязательное поле')).toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it('sends type/value/trimmed reason and closes after the server recalculates totals', async () => {
    let body: unknown = null;
    mockRefetches();
    server.use(
      http.post(api('/orders/o1/discount'), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...order, discountType: 'percent', discountValue: 10, discountAmount: 10000, total: 90000 });
      }),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<DiscountModal order={order} onClose={onClose} />, { auth });

    await user.type(screen.getByLabelText(/Процент/), '10');
    await user.type(screen.getByLabelText(/Причина/), '  Постоянный гость ');
    await user.click(screen.getByRole('button', { name: 'Применить' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toEqual({ type: 'percent', value: 10, reason: 'Постоянный гость' });
    expect(await screen.findByText('Скидка применена')).toBeInTheDocument();
  });

  it('shows the localized server error code for an amount above the subtotal', async () => {
    let body: unknown = null;
    server.use(
      http.post(api('/orders/o1/discount'), async ({ request }) => {
        body = await request.json();
        return problem(422, 'order.invalid_discount');
      }),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<DiscountModal order={order} onClose={onClose} />, { auth });

    await user.selectOptions(screen.getByLabelText(/Тип скидки/), 'amount');
    await user.type(screen.getByLabelText(/^Сумма/), '150000');
    await user.type(screen.getByLabelText(/Причина/), 'Ошибка');
    await user.click(screen.getByRole('button', { name: 'Применить' }));

    expect(await screen.findByText('Недопустимая скидка: она не может превышать сумму заказа.')).toBeInTheDocument();
    expect(body).toEqual({ type: 'amount', value: 150000, reason: 'Ошибка' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes the discount without requiring a reason', async () => {
    let body: unknown = null;
    mockRefetches();
    server.use(
      http.post(api('/orders/o1/discount'), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(order);
      }),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    const discounted = { ...order, discountType: 'amount' as const, discountValue: 5000, discountAmount: 5000 };
    renderWithProviders(<DiscountModal order={discounted} onClose={onClose} />, { auth });

    await user.selectOptions(screen.getByLabelText(/Тип скидки/), 'none');
    await user.click(screen.getByRole('button', { name: 'Применить' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toEqual({ type: 'none', value: 0, reason: '' });
  });
});
