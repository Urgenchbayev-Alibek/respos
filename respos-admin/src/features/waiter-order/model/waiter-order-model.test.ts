import { describe, expect, it } from 'vitest';
import type { ModifierGroupDto } from '@/entities/menu/menu.types';
import { cartQuantity, cartReducer, toAddItems, type CartLine } from './cart';
import { toggleOption, validateSelection } from './modifier-selection';

const group = (overrides: Partial<ModifierGroupDto>): ModifierGroupDto => ({
  id: 'g',
  name: 'G',
  minSelect: 0,
  maxSelect: 1,
  isRequired: false,
  options: [
    { id: 'a', name: 'A', priceDelta: 0 },
    { id: 'b', name: 'B', priceDelta: 0 },
    { id: 'c', name: 'C', priceDelta: 0 },
  ],
  ...overrides,
});

describe('modifier selection', () => {
  it('requires at least one option in a required group even with minSelect 0', () => {
    expect(validateSelection([group({ isRequired: true })], {})).toEqual({ g: { kind: 'min', min: 1 } });
    expect(validateSelection([group({ isRequired: true })], { g: ['a'] })).toEqual({});
  });

  it('respects minSelect and maxSelect', () => {
    const g = group({ minSelect: 2, maxSelect: 2 });
    expect(validateSelection([g], { g: ['a'] })).toEqual({ g: { kind: 'min', min: 2 } });
    expect(validateSelection([g], { g: ['a', 'b', 'c'] })).toEqual({ g: { kind: 'max', max: 2 } });
  });

  it('swaps single choice and stops at max for multi choice', () => {
    expect(toggleOption(group({}), { g: ['a'] }, 'b')).toEqual({ g: ['b'] });
    const multi = group({ maxSelect: 2 });
    expect(toggleOption(multi, { g: ['a', 'b'] }, 'c')).toEqual({ g: ['a', 'b'] });
    expect(toggleOption(multi, { g: ['a', 'b'] }, 'a')).toEqual({ g: ['b'] });
  });
});

describe('cart', () => {
  const line = {
    menuItemId: 'm1',
    name: 'Плов',
    unitPrice: 45000,
    modifierOptionIds: [],
    modifierNames: [],
    quantity: 1,
    comment: '',
  };

  it('merges identical lines and removes a line at zero', () => {
    let state: CartLine[] = cartReducer([], { type: 'add', line });
    state = cartReducer(state, { type: 'add', line });
    expect(state).toHaveLength(1);
    expect(cartQuantity(state)).toBe(2);
    const key = state[0]?.key ?? '';
    state = cartReducer(state, { type: 'decrement', key });
    state = cartReducer(state, { type: 'decrement', key });
    expect(state).toEqual([]);
  });

  it('keeps lines with different comments apart and maps to AddItem', () => {
    let state = cartReducer([], { type: 'add', line });
    state = cartReducer(state, { type: 'add', line: { ...line, comment: 'без лука' } });
    expect(toAddItems(state)).toEqual([
      { menuItemId: 'm1', variantId: undefined, quantity: 1, modifierOptionIds: [], comment: undefined },
      { menuItemId: 'm1', variantId: undefined, quantity: 1, modifierOptionIds: [], comment: 'без лука' },
    ]);
  });
});
