import type { SplitOrderInput } from '@/entities/billing/billing.types';
import type { OrderDto } from '@/entities/order/order.types';
import { PERMISSIONS, type Permission } from '@/shared/constants/permissions';
import { isOrderOpen } from '@/entities/order/order.types';

/** Preview only — the server computes the real amounts (AwayFromZero, remainder on the last bill). */
const toCents = (value: number) => Math.round(value * 100);

export function previewEqualSplit(total: number, parts: number): number[] {
  if (!Number.isInteger(parts) || parts < 2 || parts > 20 || total <= 0) return [];
  const totalCents = toCents(total);
  const share = Math.round(totalCents / parts);
  const amounts = Array.from({ length: parts - 1 }, () => share);
  amounts.push(totalCents - share * (parts - 1));
  return amounts.map((cents) => cents / 100);
}

export function sumMoney(values: readonly (number | null)[]): number {
  return values.reduce<number>((sum, value) => sum + toCents(value ?? 0), 0) / 100;
}

export function amountsMatchTotal(values: readonly (number | null)[], total: number): boolean {
  return values.every((value) => value !== null && value > 0) && toCents(sumMoney(values)) === toCents(total);
}

/** `allocations[bill][orderItemId] = quantity`; empty bills and zero quantities are dropped. */
export function buildItemsSplit(allocations: readonly Record<string, number>[]): SplitOrderInput {
  const bills = allocations
    .map((bill) => ({
      items: Object.entries(bill)
        .filter(([, quantity]) => quantity > 0)
        .map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
    }))
    .filter((bill) => bill.items.length > 0);
  return { mode: 'items', bills };
}

type HasPermission = (permission: Permission) => boolean;

/** UX gating only — backend enforces orders.split and the "no payments" rule. */
export function canSplitOrder(order: OrderDto, has: HasPermission): boolean {
  return isOrderOpen(order) && !order.isSplit && order.paidAmount === 0 && order.total > 0 && has(PERMISSIONS.orders.split);
}

export function canMergeBills(order: OrderDto, has: HasPermission): boolean {
  return isOrderOpen(order) && Boolean(order.isSplit) && order.paidAmount === 0 && has(PERMISSIONS.orders.split);
}
