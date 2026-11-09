import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PurchaseDto } from '@/entities/purchase/purchase.types';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { api, http, HttpResponse, problem, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { ReceivePurchaseModal } from './ReceivePurchaseModal';

const purchase: PurchaseDto = {
  id: 'po-1',
  number: 15,
  supplierId: 'sup-1',
  supplierName: 'ООО «Агро»',
  status: 'submitted',
  expectedAt: null,
  total: 1080000,
  comment: null,
  createdAt: '2026-11-09T08:00:00Z',
  items: [
    { id: 'li-1', ingredientId: 'ing-1', ingredientName: 'Рис девзира', quantity: 50, unitId: 'kg', unitCode: 'kg', unitPrice: 18000, receivedQuantity: 0, lineTotal: 900000 },
    { id: 'li-2', ingredientId: 'ing-2', ingredientName: 'Морковь', quantity: 30, unitId: 'kg', unitCode: 'kg', unitPrice: 6000, receivedQuantity: 10, lineTotal: 180000 },
  ],
};

const auth = makeAuth(makeUser({ permissions: [P.purchases.read, P.purchases.receive] }));

describe('ReceivePurchaseModal', () => {
  it('receives per line with an Idempotency-Key that is reused on retry', async () => {
    const calls: { key: string | null; body: unknown }[] = [];
    let attempt = 0;
    server.use(
      http.post(api('/purchases/po-1/receive'), async ({ request }) => {
        calls.push({ key: request.headers.get('Idempotency-Key'), body: await request.json() });
        attempt += 1;
        return attempt === 1 ? problem(500, 'server.error') : HttpResponse.json({ ...purchase, status: 'partially_received' });
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(<ReceivePurchaseModal purchase={purchase} onClose={onClose} />, { auth });

    const rice = screen.getByLabelText('Принять: Рис девзира');
    const carrot = screen.getByLabelText('Принять: Морковь');
    expect(rice).toHaveValue('50');
    expect(carrot).toHaveValue('20');
    await userEvent.clear(rice);
    await userEvent.type(rice, '20,5');
    await userEvent.clear(carrot);

    await userEvent.click(screen.getByRole('button', { name: 'Принять на склад' }));
    expect(await screen.findByText('Ошибка сервера. Мы уже разбираемся.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Принять на склад' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(calls).toHaveLength(2);
    expect(calls[0]?.body).toEqual({ lines: [{ itemId: 'li-1', quantity: 20.5 }] });
    expect(calls[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls[1]?.key).toBe(calls[0]?.key);
  });

  it('requires at least one line and rejects invalid quantities', async () => {
    const post = vi.fn();
    server.use(http.post(api('/purchases/po-1/receive'), () => { post(); return HttpResponse.json(purchase); }));
    renderWithProviders(<ReceivePurchaseModal purchase={purchase} onClose={vi.fn()} />, { auth });

    await userEvent.clear(screen.getByLabelText('Принять: Рис девзира'));
    await userEvent.clear(screen.getByLabelText('Принять: Морковь'));
    await userEvent.click(screen.getByRole('button', { name: 'Принять на склад' }));
    expect(await screen.findByText('Укажите количество хотя бы по одной строке')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Принять: Морковь'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Принять на склад' }));
    expect(await screen.findByText(/не более 3 знаков/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
