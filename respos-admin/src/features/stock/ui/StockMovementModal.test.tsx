import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { IngredientDto } from '@/entities/ingredient/ingredient.types';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { api, http, HttpResponse, problem, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { StockMovementModal } from './StockMovementModal';

const rice: IngredientDto = {
  id: 'ing-1',
  name: 'Рис девзира',
  sku: 'GR-001',
  categoryId: null,
  categoryName: null,
  baseUnitId: 'unit-kg',
  baseUnitCode: 'kg',
  costPrice: 28000,
  quantity: 4.2,
  minQuantity: 10,
  isLow: true,
  isArchived: false,
};

const auth = makeAuth(makeUser({ permissions: [P.inventory.read, P.inventory.adjust] }));

function renderModal(onClose = vi.fn()) {
  server.use(http.get(api('/units'), () => HttpResponse.json([{ id: 'unit-kg', code: 'kg', name: 'Килограмм', kind: 'mass' }])));
  renderWithProviders(<StockMovementModal open ingredient={rice} onClose={onClose} />, { auth });
  return onClose;
}

describe('StockMovementModal', () => {
  it('validates quantity and the mandatory reason before calling the API', async () => {
    const post = vi.fn();
    server.use(http.post(api('/stock/movements'), () => { post(); return HttpResponse.json({}, { status: 201 }); }));
    renderModal();

    expect(screen.getByRole('dialog', { name: 'Списание' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((a) => a.textContent)).toEqual(expect.arrayContaining(['Обязательное поле']));

    await userEvent.type(screen.getByLabelText(/Количество/), '-2');
    await userEvent.type(screen.getByLabelText(/Причина/), 'Порча');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText('Должно быть больше нуля')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(/Количество/));
    await userEvent.type(screen.getByLabelText(/Количество/), '1,2345');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText(/не более 3 знаков/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('shows 409 stock.insufficient next to the quantity field', async () => {
    let body: unknown;
    server.use(
      http.post(api('/stock/movements'), async ({ request }) => {
        body = await request.json();
        return problem(409, 'stock.insufficient');
      }),
    );
    const onClose = renderModal();

    await userEvent.type(screen.getByLabelText(/Количество/), '5');
    await userEvent.type(screen.getByLabelText(/Причина/), 'Истёк срок годности');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const quantity = screen.getByLabelText(/Количество/);
    await waitFor(() => expect(quantity).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText('Недостаточно остатка на складе.')).toBeInTheDocument();
    expect(body).toEqual({ ingredientId: 'ing-1', type: 'write_off', quantity: 5, reason: 'Истёк срок годности' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
