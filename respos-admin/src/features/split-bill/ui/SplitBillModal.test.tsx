import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeOrder, makeOrderItem } from '@/test/fixtures/floor-orders';
import { api, http, HttpResponse, problem, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { buildItemsSplit, previewEqualSplit } from '../model/split-math';
import { SplitBillModal } from './SplitBillModal';

const auth = makeAuth(makeUser({ permissions: ['orders.read', 'orders.split'] }));
const order = makeOrder({
  status: 'served',
  items: [
    makeOrderItem({ id: 'plov', name: 'Плов', quantity: 2, lineTotal: 90000 }),
    makeOrderItem({ id: 'tea', name: 'Чай', quantity: 1, unitPrice: 10000, lineTotal: 10000 }),
  ],
  subtotal: 100000,
  total: 100000,
  remainingAmount: 100000,
});

function mockRefetch() {
  server.use(http.get(api('/orders/*'), () => HttpResponse.json(order)));
}

describe('split-math', () => {
  it('previews an equal split with the remainder on the last bill', () => {
    expect(previewEqualSplit(100, 3)).toEqual([33.33, 33.33, 33.34]);
    expect(previewEqualSplit(200, 3)).toEqual([66.67, 66.67, 66.66]);
    expect(previewEqualSplit(100, 1)).toEqual([]);
  });

  it('drops empty allocations when building an items split', () => {
    expect(buildItemsSplit([{ plov: 1, tea: 0 }, {}])).toEqual({
      mode: 'items',
      bills: [{ items: [{ orderItemId: 'plov', quantity: 1 }] }],
    });
  });
});

describe('SplitBillModal', () => {
  it('splits equally into the chosen number of parts', async () => {
    mockRefetch();
    let body: unknown = null;
    server.use(
      http.post(api('/orders/o1/split'), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...order, isSplit: true });
      }),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<SplitBillModal order={order} onClose={onClose} />, { auth });

    const parts = screen.getByLabelText(/Количество частей/);
    await user.clear(parts);
    await user.type(parts, '3');
    expect(screen.getByTestId('split-preview').textContent?.replace(/\s/g, ' ')).toMatch(/33 333,34/);
    await user.click(screen.getByRole('button', { name: 'Разделить' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toEqual({ mode: 'equal', parts: 3 });
  });

  it('blocks custom amounts that do not add up to the total', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SplitBillModal order={order} onClose={vi.fn()} />, { auth });

    await user.click(screen.getByRole('tab', { name: 'Свои суммы' }));
    const first = screen.getByLabelText('Счёт 1');
    await user.clear(first);
    await user.type(first, '10000');
    await user.tab();

    expect(screen.getByText(/Сумма счетов должна равняться итогу заказа/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Разделить' })).toBeDisabled();
  });

  it('moves a partial item quantity to a new bill and shows server errors', async () => {
    let body: unknown = null;
    server.use(
      http.post(api('/orders/o1/split'), async ({ request }) => {
        body = await request.json();
        return problem(409, 'order.already_split');
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<SplitBillModal order={order} onClose={vi.fn()} />, { auth });

    await user.click(screen.getByRole('tab', { name: 'По позициям' }));
    await user.type(screen.getByLabelText('Количество «Плов» в счёте 1'), '1');
    await user.click(screen.getByRole('button', { name: 'Разделить' }));

    expect(await screen.findByText(/Заказ уже разделён/)).toBeInTheDocument();
    expect(body).toEqual({ mode: 'items', bills: [{ items: [{ orderItemId: 'plov', quantity: 1 }] }] });
  });
});
