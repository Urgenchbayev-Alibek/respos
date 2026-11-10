import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { StockTransferDto } from '@/entities/stock-transfer/stock-transfer.types';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { TransferDetailDrawer } from './TransferDetailDrawer';

const transfer = (patch: Partial<StockTransferDto>): StockTransferDto => ({
  id: 'tr-1',
  number: 3,
  fromBranchId: 'b-1',
  fromBranchName: 'Центр',
  toBranchId: 'b-2',
  toBranchName: 'Чиланзар',
  status: 'sent',
  direction: 'incoming',
  comment: null,
  totalCost: 87500,
  lineCount: 1,
  createdAt: '2026-11-10T08:00:00Z',
  sentAt: '2026-11-10T09:00:00Z',
  receivedAt: null,
  cancelledAt: null,
  lines: [
    {
      id: 'l-1',
      ingredientId: 'rice',
      ingredientName: 'Рис',
      quantity: 3.5,
      unitId: 'kg',
      unitCode: 'kg',
      baseQuantity: 3.5,
      baseUnitCode: 'kg',
      unitCost: 25000,
    },
  ],
  ...patch,
});

const auth = makeAuth(makeUser({ permissions: [P.inventory.read, P.inventory.transfer] }));

describe('TransferDetailDrawer', () => {
  it('receives an incoming sent transfer with an Idempotency-Key', async () => {
    const keys: (string | null)[] = [];
    server.use(
      http.get(api('/stock/transfers/tr-1'), () => HttpResponse.json(transfer({}))),
      http.post(api('/stock/transfers/tr-1/receive'), ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        return HttpResponse.json(transfer({ status: 'received' }));
      }),
    );
    renderWithProviders(<TransferDetailDrawer transferId="tr-1" onClose={() => undefined} />, { auth });

    expect(await screen.findByText('Рис')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Отправить' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Принять' }));
    await waitFor(() => expect(keys).toHaveLength(1));
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('offers send / edit / cancel for an outgoing draft and no receive', async () => {
    server.use(
      http.get(api('/stock/transfers/tr-1'), () => HttpResponse.json(transfer({ status: 'draft', direction: 'outgoing', sentAt: null }))),
    );
    renderWithProviders(<TransferDetailDrawer transferId="tr-1" onClose={() => undefined} />, { auth });

    expect(await screen.findByRole('button', { name: 'Отправить' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Изменить' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отменить' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Принять' })).not.toBeInTheDocument();
  });
});
