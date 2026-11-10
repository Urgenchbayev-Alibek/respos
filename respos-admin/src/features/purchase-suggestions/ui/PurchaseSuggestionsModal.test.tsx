import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PurchaseSuggestionsDto } from '@/entities/purchase-suggestion/purchase-suggestion.types';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { PurchaseSuggestionsModal } from './PurchaseSuggestionsModal';

const line = (ingredientId: string, ingredientName: string, suggestedQuantity: number) => ({
  ingredientId,
  ingredientName,
  baseUnitId: 'kg',
  baseUnitCode: 'kg',
  currentQuantity: 1,
  minQuantity: 5,
  onOrderQuantity: 0,
  avgDailyConsumption: 0.5,
  targetQuantity: 8.5,
  suggestedQuantity,
  lastPrice: 1000,
  estimatedTotal: suggestedQuantity * 1000,
});

const data: PurchaseSuggestionsDto = {
  coverageDays: 7,
  lookbackDays: 14,
  groups: [
    {
      supplierId: 'sup-1',
      supplierName: 'Агро',
      estimatedTotal: 12000,
      lines: [line('rice', 'Рис', 7.5), line('salt', 'Соль', 4.5)],
    },
    {
      supplierId: null,
      supplierName: null,
      estimatedTotal: 2000,
      lines: [line('onion', 'Лук', 2)],
    },
  ],
};

describe('PurchaseSuggestionsModal', () => {
  it('creates drafts only for selected lines of groups with a supplier', async () => {
    const requests: { url: string; body?: unknown }[] = [];
    server.use(
      http.get(api('/purchases/suggestions'), ({ request }) => {
        requests.push({ url: request.url });
        return HttpResponse.json(data);
      }),
      http.post(api('/purchases/suggestions/apply'), async ({ request }) => {
        requests.push({ url: request.url, body: await request.json() });
        return HttpResponse.json([{ id: 'po-1' }], { status: 201 });
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(<PurchaseSuggestionsModal open onClose={onClose} />, {
      auth: makeAuth(makeUser({ permissions: [P.purchases.read, P.purchases.manage] })),
    });

    const agro = await screen.findByRole('region', { name: 'Агро' });
    expect(screen.getByText('Укажите поставщика по умолчанию в карточке ингредиента, чтобы заказать эти позиции.')).toBeInTheDocument();
    const [riceBox, saltBox] = within(agro).getAllByRole('checkbox', {
      name: 'Включить',
    });
    expect(riceBox).toBeChecked();
    await userEvent.click(saltBox as HTMLElement);
    const [riceQty] = within(agro).getAllByRole('textbox', {
      name: 'Заказать',
    });
    await userEvent.clear(riceQty as HTMLElement);
    await userEvent.type(riceQty as HTMLElement, '10');

    await userEvent.click(screen.getByRole('button', { name: 'Создать черновики (1)' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(requests[0]?.url).toContain('coverageDays=7');
    expect(requests.find((r) => r.body !== undefined)?.body).toEqual({
      comment: 'Создано из предложений закупки',
      lines: [{ ingredientId: 'rice', supplierId: 'sup-1', quantity: 10 }],
    });
  });

  it('shows the empty state and hides apply without purchases.manage', async () => {
    server.use(http.get(api('/purchases/suggestions'), () => HttpResponse.json({ coverageDays: 7, lookbackDays: 14, groups: [] })));
    renderWithProviders(<PurchaseSuggestionsModal open onClose={vi.fn()} />, {
      auth: makeAuth(makeUser({ permissions: [P.purchases.read] })),
    });
    expect(await screen.findByText('Все остатки в норме — закупать нечего.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Создать черновики/ })).not.toBeInTheDocument();
  });
});
