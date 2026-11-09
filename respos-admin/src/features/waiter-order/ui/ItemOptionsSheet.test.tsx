import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeMenuItem } from '@/test/fixtures/floor-orders';
import { renderWithProviders } from '@/test/test-utils';
import { ItemOptionsSheet } from './ItemOptionsSheet';

const shashlik = makeMenuItem({
  id: 'm3',
  name: 'Шашлык',
  price: 60000,
  variants: [],
  modifierGroups: [
    {
      id: 'g1',
      name: 'Прожарка',
      minSelect: 0,
      maxSelect: 1,
      isRequired: true,
      options: [
        { id: 'o1', name: 'Medium', priceDelta: 0 },
        { id: 'o2', name: 'Well done', priceDelta: 0 },
      ],
    },
    {
      id: 'g2',
      name: 'Соус',
      minSelect: 0,
      maxSelect: 2,
      isRequired: false,
      options: [{ id: 's1', name: 'Сырный', priceDelta: 5000 }],
    },
  ],
});

describe('ItemOptionsSheet', () => {
  it('blocks adding until the required modifier group is chosen', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ItemOptionsSheet item={shashlik} onAdd={onAdd} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Добавить/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Выберите минимум 1');
    expect(onAdd).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Medium' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Well done' }));
    expect(screen.getByRole('button', { name: 'Well done' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: /Сырный/ }));
    await user.click(screen.getByRole('button', { name: /Добавить/ }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        menuItemId: 'm3',
        modifierOptionIds: ['o2', 's1'],
        modifierNames: ['Well done', 'Сырный'],
        unitPrice: 65000,
        quantity: 1,
      }),
    );
  });

  it('preselects the default variant and uses its absolute price', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    const item = makeMenuItem({
      variants: [
        { id: 'v1', name: '0,5 порции', price: 30000, isDefault: false },
        { id: 'v2', name: '1 порция', price: 45000, isDefault: true },
      ],
    });
    renderWithProviders(<ItemOptionsSheet item={item} onAdd={onAdd} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: /1 порция/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /0,5 порции/ }));
    await user.click(screen.getByRole('button', { name: /Добавить/ }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ variantId: 'v1', variantName: '0,5 порции', unitPrice: 30000 }));
  });
});
