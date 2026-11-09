import { isOrderOpen, type OrderDto, type OrderItemDto } from '@/entities/order/order.types';
import { PERMISSIONS, type Permission } from '@/shared/constants/permissions';

type HasPermission = (permission: Permission) => boolean;

/** UX gating only — the backend enforces the same rules. */
export function canApplyDiscount(order: OrderDto, has: HasPermission): boolean {
  return isOrderOpen(order) && has(PERMISSIONS.orders.discountApply);
}

export function canTransferOrder(order: OrderDto, has: HasPermission): boolean {
  return isOrderOpen(order) && order.type === 'dine_in' && has(PERMISSIONS.orders.transfer);
}

/** `new` items: orders.update (or orders.cancel); items already sent to the kitchen: orders.cancel. */
export function canCancelItem(order: OrderDto, item: OrderItemDto, has: HasPermission): boolean {
  if (!isOrderOpen(order) || item.status === 'cancelled' || item.status === 'served') return false;
  if (has(PERMISSIONS.orders.cancel)) return true;
  return item.status === 'new' && has(PERMISSIONS.orders.update);
}
