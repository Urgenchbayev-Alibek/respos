import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { BranchMenuItemDto } from '@/entities/branch-menu/branch-menu.types';
import type { MenuItemDto } from '@/entities/menu/menu.types';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { BranchOverridesModal } from './BranchOverridesModal';

const item = {
  id: 'plov',
  categoryId: 'c',
  categoryName: 'Горячее',
  name: 'Плов',
  nameUz: null,
  description: null,
  photoUrl: null,
  price: 45000,
  prepTimeMinutes: 15,
  kitchenStationId: null,
  isAvailable: true,
  isArchived: false,
  sku: null,
  variants: [{ id: 'half', name: '0.5', price: 25000, isDefault: false }],
  modifierGroups: [],
  availability: [],
} as MenuItemDto;

const row = (branchId: string, branchName: string): BranchMenuItemDto => ({
  branchId,
  branchName,
  menuItemId: 'plov',
  hasOverride: false,
  priceOverride: null,
  isAvailable: null,
  kitchenStationId: null,
  kitchenStationName: null,
  effectivePrice: 45000,
  effectiveIsAvailable: true,
  effectiveKitchenStationId: null,
  variants: [
    {
      variantId: 'half',
      variantName: '0.5',
      basePrice: 25000,
      priceOverride: null,
      effectivePrice: 25000,
    },
  ],
});

describe('BranchOverridesModal', () => {
  it('saves a branch price, variant price, stop-list and station without X-Branch-Id', async () => {
    let saved: { body: unknown; branchHeader: string | null } | null = null;
    server.use(
      http.get(api('/menu/items/plov/branches'), () => HttpResponse.json([row('b-1', 'Центр'), row('b-2', 'Чиланзар')])),
      http.get(api('/kitchen-stations'), ({ request }) =>
        HttpResponse.json(
          request.headers.get('X-Branch-Id') === 'b-2' ? [{ id: 'st-2', name: 'Горячий Ч', sortOrder: 0, isActive: true }] : [],
        ),
      ),
      http.put(api('/menu/items/plov/branches/b-2'), async ({ request }) => {
        saved = {
          body: await request.json(),
          branchHeader: request.headers.get('X-Branch-Id'),
        };
        return HttpResponse.json({
          ...row('b-2', 'Чиланзар'),
          hasOverride: true,
        });
      }),
    );
    renderWithProviders(<BranchOverridesModal item={item} onClose={() => undefined} />, {
      auth: makeAuth(makeUser({ permissions: [P.menu.read, P.menu.manage] })),
    });

    const card = await screen.findByRole('region', { name: 'Чиланзар' });
    await userEvent.type(within(card).getByLabelText('Цена в филиале'), '50000');
    await userEvent.type(within(card).getByLabelText('Цена «0.5»'), '27000');
    await userEvent.selectOptions(within(card).getByLabelText('Доступность'), 'off');
    await within(card).findByRole('option', { name: 'Горячий Ч' });
    await userEvent.selectOptions(within(card).getByLabelText('Цех'), 'st-2');
    await userEvent.click(within(card).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toEqual({
      branchHeader: null,
      body: {
        priceOverride: 50000,
        isAvailable: false,
        kitchenStationId: 'st-2',
        variantPrices: [{ variantId: 'half', price: 27000 }],
      },
    });
  });
});
