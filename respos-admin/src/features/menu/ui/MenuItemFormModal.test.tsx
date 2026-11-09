import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MenuCategoryDto } from '@/entities/menu/menu.types';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { makeMenuItem } from '@/test/fixtures/floor-orders';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { MenuItemFormModal } from './MenuItemFormModal';

const auth = makeAuth(makeUser({ permissions: [PERMISSIONS.menu.read, PERMISSIONS.menu.manage, PERMISSIONS.kitchen.read] }));
const categories: MenuCategoryDto[] = [
  { id: 'c1', name: 'Горячее', nameUz: null, sortOrder: 1, isActive: true, isArchived: false, itemCount: 1 },
];

function mockLookups() {
  server.use(
    http.get(api('/kitchen-stations'), () =>
      HttpResponse.json([{ id: 'k1', name: 'Горячий цех', sortOrder: 1, isActive: true }]),
    ),
    http.get(api('/menu/modifier-groups'), () =>
      HttpResponse.json([{ id: 'g1', name: 'Соус', minSelect: 0, maxSelect: 1, isRequired: false, options: [] }]),
    ),
  );
}

describe('MenuItemFormModal', () => {
  it('shows field errors for required name, category and price without calling the API', async () => {
    mockLookups();
    const user = userEvent.setup();
    renderWithProviders(<MenuItemFormModal item={null} categories={[]} onClose={vi.fn()} />, { auth });

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(screen.getAllByText('Обязательное поле')).toHaveLength(3));
  });

  it('requires exactly one default variant and a valid prep time', async () => {
    mockLookups();
    const user = userEvent.setup();
    renderWithProviders(<MenuItemFormModal item={makeMenuItem()} categories={categories} onClose={vi.fn()} />, { auth });

    await user.type(screen.getByLabelText(/Время приготовления/), 'x');
    await user.click(screen.getByRole('button', { name: 'Добавить вариант' }));
    await user.click(screen.getByRole('button', { name: 'Добавить вариант' }));
    const radios = screen.getAllByRole('radio');
    await user.click(radios[1] as HTMLElement);
    expect(radios[0]).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Целое число минут (0–999)')).toBeInTheDocument();
    expect(screen.getAllByText('Обязательное поле').length).toBeGreaterThanOrEqual(2);
  });

  it('submits variants with absolute prices, modifier group links and the station', async () => {
    mockLookups();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(api('/menu/items'), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeMenuItem({ id: 'new' }), { status: 201 });
      }),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<MenuItemFormModal item={null} categories={categories} onClose={onClose} />, { auth });

    await user.type(screen.getByLabelText(/Название \(RU\)/), 'Лагман');
    await user.type(screen.getByLabelText(/^Цена/), '38000');
    await user.selectOptions(screen.getByLabelText(/Станция кухни/), await screen.findByRole('option', { name: 'Горячий цех' }));
    await user.click(await screen.findByRole('checkbox', { name: /Соус/ }));
    await user.click(screen.getByRole('button', { name: 'Добавить вариант' }));
    await user.type(screen.getByLabelText(/Название варианта/), '1 порция');
    await user.type(screen.getByLabelText(/Цена варианта/), '38000');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toMatchObject({
      name: 'Лагман',
      categoryId: 'c1',
      price: 38000,
      kitchenStationId: 'k1',
      prepTimeMinutes: 0,
      isAvailable: true,
      variants: [{ name: '1 порция', price: 38000, isDefault: true }],
      modifierGroupIds: ['g1'],
    });
  });
});
