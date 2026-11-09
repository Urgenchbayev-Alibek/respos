import type { AddOrderItem } from '@/entities/order/order.types';

/**
 * Local cart of NEW items not yet saved to the order. Prices here are a preview for the waiter only;
 * the server recalculates every line and the order totals (server result wins).
 */
export interface CartLine {
  key: string;
  menuItemId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  /** Preview: variant (absolute) price or item price + modifier deltas. */
  unitPrice: number;
  modifierOptionIds: string[];
  modifierNames: string[];
  quantity: number;
  comment: string;
}

export type CartAction =
  | { type: 'add'; line: Omit<CartLine, 'key'> }
  | { type: 'increment'; key: string }
  | { type: 'decrement'; key: string }
  | { type: 'remove'; key: string }
  | { type: 'comment'; key: string; comment: string }
  | { type: 'clear' };

let sequence = 0;
const nextKey = () => {
  sequence += 1;
  return `cart-${sequence}`;
};

function sameChoice(a: Omit<CartLine, 'key'>, b: CartLine): boolean {
  return (
    a.menuItemId === b.menuItemId &&
    a.variantId === b.variantId &&
    a.comment === b.comment &&
    a.modifierOptionIds.length === b.modifierOptionIds.length &&
    a.modifierOptionIds.every((id) => b.modifierOptionIds.includes(id))
  );
}

export const MAX_LINE_QUANTITY = 99;

export function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add': {
      const existing = state.find((line) => sameChoice(action.line, line));
      if (existing) {
        return state.map((line) =>
          line === existing ? { ...line, quantity: Math.min(MAX_LINE_QUANTITY, line.quantity + action.line.quantity) } : line,
        );
      }
      return [...state, { ...action.line, key: nextKey() }];
    }
    case 'increment':
      return state.map((line) =>
        line.key === action.key ? { ...line, quantity: Math.min(MAX_LINE_QUANTITY, line.quantity + 1) } : line,
      );
    case 'decrement':
      return state.flatMap((line) => {
        if (line.key !== action.key) return [line];
        return line.quantity <= 1 ? [] : [{ ...line, quantity: line.quantity - 1 }];
      });
    case 'remove':
      return state.filter((line) => line.key !== action.key);
    case 'comment':
      return state.map((line) => (line.key === action.key ? { ...line, comment: action.comment } : line));
    case 'clear':
      return [];
    default:
      return state;
  }
}

export function toAddItems(lines: CartLine[]): AddOrderItem[] {
  return lines.map((line) => ({
    menuItemId: line.menuItemId,
    variantId: line.variantId,
    quantity: line.quantity,
    modifierOptionIds: line.modifierOptionIds,
    comment: line.comment.trim() || undefined,
  }));
}

export function cartQuantity(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** Display-only preview (labelled "preliminary" in the UI). */
export function cartPreviewTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}
