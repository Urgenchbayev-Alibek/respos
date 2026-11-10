import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { PaymentIntentDto, PaymentProviderDto } from '@/entities/billing/billing.types';
import { makeOrder, makeOrderItem } from '@/test/fixtures/floor-orders';
import { makeCashShift, makePayment } from '@/test/fixtures/payments';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { PaymentPanel } from './PaymentPanel';

const auth = makeAuth(makeUser({ permissions: ['orders.read', 'orders.split', 'payments.create', 'cash-shifts.read'] }));
const bill = (id: string, number: number, amount: number, status: 'open' | 'paid' = 'open') => ({
  id, number, mode: 'equal' as const, amount, paidAmount: status === 'paid' ? amount : 0,
  remainingAmount: status === 'paid' ? 0 : amount, status, items: [],
});
const splitOrder = makeOrder({
  status: 'served',
  items: [makeOrderItem({ status: 'served', quantity: 2, lineTotal: 100000 })],
  subtotal: 100000,
  total: 100000,
  paidAmount: 33333.33,
  remainingAmount: 66666.67,
  isSplit: true,
  bills: [bill('b1', 1, 33333.33, 'paid'), bill('b2', 2, 33333.33), bill('b3', 3, 33333.34)],
});

const provider = (overrides: Partial<PaymentProviderDto>): PaymentProviderDto => ({
  code: 'payme', status: 'test', isImplemented: true, isConfigured: true, isEnabled: true, isAvailable: true,
  callbackPath: '/api/v1/payments/providers/payme/callback', ...overrides,
});

const intent = (overrides: Partial<PaymentIntentDto> = {}): PaymentIntentDto => ({
  id: 'pi1', orderId: 'o1', billId: 'b2', provider: 'payme', amount: 33333.33, tipAmount: 0, totalAmount: 33333.33,
  status: 'pending', isExpired: false, paymentUrl: 'https://checkout.test.paycom.uz/abc', expiresAt: '2026-11-10T08:00:00Z',
  paymentId: null, createdAt: '2026-11-10T07:45:00Z', ...overrides,
});

function mockBase(providers: PaymentProviderDto[]) {
  server.use(
    http.get(api('/orders/o1'), () => HttpResponse.json(splitOrder)),
    http.get(api('/cash-shifts/current'), () => HttpResponse.json(makeCashShift())),
    http.get(api('/payments/providers'), () => HttpResponse.json(providers)),
  );
}

describe('PaymentPanel — split bills and online providers', () => {
  it('pays the selected bill with a tip (billId + tipAmount sent, amount limited to the bill)', async () => {
    mockBase([provider({ code: 'uzum', status: 'not_connected', isImplemented: false, isConfigured: false, isEnabled: false, isAvailable: false })]);
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(api('/payments'), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makePayment({ amount: 33333.34 }), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<PaymentPanel orderId="o1" />, { auth });

    expect(await screen.findByTestId('bill-1')).toBeDisabled();
    expect(await screen.findByText('Не подключено')).toBeInTheDocument();
    await user.click(screen.getByTestId('bill-3'));
    expect((screen.getByLabelText(/Сумма платежа/) as HTMLInputElement).value.replace(/\s/g, ' ')).toBe('33 333,34');
    await user.type(screen.getByLabelText(/Чаевые/), '5000');
    await user.click(screen.getByRole('button', { name: /Принять оплату/ }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ orderId: 'o1', billId: 'b3', amount: 33333.34, tipAmount: 5000, method: 'cash' });
  });

  it('creates a provider payment link with a QR code and shows the confirmation', async () => {
    mockBase([provider({})]);
    let polls = 0;
    let created: Record<string, unknown> | null = null;
    server.use(
      http.post(api('/payments/intents'), async ({ request }) => {
        created = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(intent(), { status: 201 });
      }),
      http.get(api('/payments/intents/pi1'), () => {
        polls += 1;
        return HttpResponse.json(intent(polls > 1 ? { status: 'completed', paymentId: 'p9' } : {}));
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<PaymentPanel orderId="o1" />, { auth });

    await user.click(await screen.findByRole('button', { name: /QR \/ ссылка Payme/ }));

    expect(await screen.findByTestId('qr-code')).toHaveAttribute('alt', 'QR-код для оплаты через Payme');
    expect(screen.getByRole('link', { name: /Открыть ссылку/ })).toHaveAttribute('href', 'https://checkout.test.paycom.uz/abc');
    expect(created).toMatchObject({ orderId: 'o1', billId: 'b2', provider: 'payme' });
    expect(await screen.findByText('Оплата подтверждена провайдером', {}, { timeout: 5000 })).toBeInTheDocument();
  }, 10000);
});
