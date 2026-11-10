import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { WaiterCallsPage } from './WaiterCallsPage';

const call = {
  id: 'w1',
  tableId: 't1',
  tableNumber: '5',
  reason: 'bill',
  status: 'active',
  createdAt: '2026-11-10T08:00:00Z',
  acknowledgedAt: null,
  acknowledgedBy: null,
  acknowledgedByName: null,
};

describe('WaiterCallsPage', () => {
  it('lists active calls and acknowledges one', async () => {
    let acknowledged = false;
    server.use(
      http.get(api('/waiter-calls'), () => HttpResponse.json(acknowledged ? [] : [call])),
      http.post(api('/waiter-calls/w1/acknowledge'), () => {
        acknowledged = true;
        return HttpResponse.json({ ...call, status: 'acknowledged' });
      }),
    );
    renderWithProviders(<WaiterCallsPage />, { auth: makeAuth(makeUser({ permissions: ['orders.read', 'orders.update'] })) });

    expect(await screen.findByText('Стол 5')).toBeInTheDocument();
    expect(screen.getByText('Просят счёт')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Иду' }));

    await waitFor(() => expect(screen.getByText('Активных вызовов нет')).toBeInTheDocument());
  });
});
