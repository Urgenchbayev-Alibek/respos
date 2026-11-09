import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeOrder, makeTable } from '@/test/fixtures/floor-orders';
import { api, http, HttpResponse, problem, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { TransferTableModal } from './TransferTableModal';

const auth = makeAuth(makeUser({ permissions: ['orders.read', 'orders.transfer'] }));
const order = makeOrder({ status: 'submitted' });
const tables = [
  makeTable(),
  makeTable({ id: 't2', number: '9', capacity: 6 }),
  makeTable({ id: 't3', number: '10', status: 'occupied' }),
  makeTable({ id: 't4', number: '11', status: 'unavailable' }),
  makeTable({ id: 't5', number: '12', isActive: false }),
];

describe('TransferTableModal', () => {
  it('lists only free tables other than the current one and posts the chosen tableId', async () => {
    let body: unknown = null;
    server.use(
      http.get(api('/tables'), () => HttpResponse.json(tables)),
      http.post(api('/orders/o1/transfer'), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...order, tableId: 't2', tableNumber: '9' });
      }),
      http.get(api('/orders/*'), () => HttpResponse.json(order)),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<TransferTableModal order={order} onClose={onClose} />, { auth });

    const select = await screen.findByLabelText(/Новый стол/);
    const options = within(select)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual(['Выберите стол…', 'Стол 9 · Основной · 6 мест']);
    expect(screen.getByRole('button', { name: 'Перенести' })).toBeDisabled();

    await user.selectOptions(select, 't2');
    await user.click(screen.getByRole('button', { name: 'Перенести' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toEqual({ tableId: 't2' });
    expect(await screen.findByText('Заказ перенесён за стол 9')).toBeInTheDocument();
  });

  it('keeps the modal open with the localized error when the table became unavailable', async () => {
    server.use(
      http.get(api('/tables'), () => HttpResponse.json(tables)),
      http.post(api('/orders/o1/transfer'), () => problem(422, 'table.unavailable')),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<TransferTableModal order={order} onClose={onClose} />, { auth });

    await user.selectOptions(await screen.findByLabelText(/Новый стол/), 't2');
    await user.click(screen.getByRole('button', { name: 'Перенести' }));

    expect(await screen.findByText('Стол недоступен.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
