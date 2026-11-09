import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { describe, expect, it } from 'vitest';
import type { PayableOrderDto } from '@/entities/payment/payable-order.types';
import { api, http, HttpResponse, problem, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { PaymentPanel } from './PaymentPanel';

const order: PayableOrderDto = {
  id: 'o1',
  number: 42,
  type: 'dine_in',
  status: 'served',
  tableNumber: '7',
  waiterName: 'Шерзод',
  guestCount: 4,
  total: 291500,
  paidAmount: 150000,
  remainingAmount: 141500,
  openedAt: '2026-11-10T07:18:00Z',
  items: [
    { id: 'i1', name: 'Плов', variantName: null, unitPrice: 50000, quantity: 2, modifiers: [], comment: null, status: 'served', lineTotal: 100000 },
  ],
  subtotal: 265000,
  discountAmount: 0,
  serviceChargeAmount: 26500,
  taxAmount: 0,
  comment: null,
  payments: [],
};

const shift = {
  id: 'sh1',
  status: 'open',
  openedByName: 'Лола',
  openedAt: '2026-11-10T04:02:00Z',
  openingAmount: 500000,
  closedByName: null,
  closedAt: null,
  expectedCashAmount: 800000,
  actualCashAmount: null,
  difference: null,
  comment: null,
};

const payment = {
  id: 'p1',
  orderId: 'o1',
  method: 'cash',
  amount: 141500,
  refundedAmount: 0,
  status: 'completed',
  provider: 'manual',
  createdAt: '2026-11-10T08:00:00Z',
  createdByName: 'Лола',
};

const auth = makeAuth(makeUser({ permissions: ['orders.read', 'payments.create', 'payments.refund', 'cash-shifts.read'] }));

function mockOrderAndShift(currentShift: unknown = shift) {
  server.use(
    http.get(api('/orders/o1'), () => HttpResponse.json(order)),
    http.get(api('/cash-shifts/current'), () =>
      currentShift ? HttpResponse.json(currentShift) : new HttpResponse(null, { status: 204 }),
    ),
  );
}

const submitButton = () => screen.findByRole('button', { name: /Принять оплату/ });

describe('PaymentPanel', () => {
  it('shows server totals, the demo provider badge and the remaining amount as default', async () => {
    mockOrderAndShift();
    renderWithProviders(<PaymentPanel orderId="o1" />, { auth });

    expect(await screen.findByText('Ручная отметка (демо)')).toBeInTheDocument();
    expect(screen.getByTestId('summary-remaining').textContent?.replace(/\s/g, ' ')).toMatch(/141 500/);
    expect((screen.getByLabelText(/Сумма платежа/) as HTMLInputElement).value.replace(/\s/g, ' ')).toBe('141 500');
  });

  it('reuses the Idempotency-Key when retrying after a network failure', async () => {
    mockOrderAndShift();
    const keys: (string | null)[] = [];
    server.use(
      http.post(api('/payments'), async ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        if (keys.length === 1) return HttpResponse.error();
        return HttpResponse.json(payment, { status: 201 });
      }),
    );
    renderWithProviders(<PaymentPanel orderId="o1" />, { auth });
    const user = userEvent.setup();

    await user.click(await submitButton());
    expect(await screen.findByText(/Можно безопасно повторить/)).toBeInTheDocument();
    await user.click(await submitButton());

    expect(await screen.findByText(/Платёж принят/)).toBeInTheDocument();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });

  it('uses a new key after a definitive validation error is corrected', async () => {
    mockOrderAndShift();
    const keys: (string | null)[] = [];
    server.use(
      http.post(api('/payments'), ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        return keys.length === 1 ? problem(422, 'payment.amount_exceeds_remaining') : HttpResponse.json(payment, { status: 201 });
      }),
    );
    renderWithProviders(<PaymentPanel orderId="o1" />, { auth });
    const user = userEvent.setup();

    await user.click(await submitButton());
    await screen.findAllByRole('alert');
    await user.click(await submitButton());

    await screen.findByText(/Платёж принят/);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it('sends one request on a double click', async () => {
    mockOrderAndShift();
    let calls = 0;
    server.use(
      http.post(api('/payments'), async () => {
        calls += 1;
        await delay(50);
        return HttpResponse.json(payment, { status: 201 });
      }),
    );
    renderWithProviders(<PaymentPanel orderId="o1" />, { auth });
    const user = userEvent.setup();

    await user.dblClick(await submitButton());

    await screen.findByText(/Платёж принят/);
    expect(calls).toBe(1);
  });

  it('shows the change for cash as information only', async () => {
    mockOrderAndShift();
    renderWithProviders(<PaymentPanel orderId="o1" />, { auth });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/Получено наличными/), '200000');

    await waitFor(() => expect(screen.getByTestId('cash-change').textContent?.replace(/\s/g, ' ')).toMatch(/58 500/));
  });

  it('blocks payment when no shift is open', async () => {
    mockOrderAndShift(null);
    renderWithProviders(<PaymentPanel orderId="o1" />, { auth });

    expect(await screen.findByText('Откройте смену')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Принять оплату/ })).not.toBeInTheDocument();
  });
});
