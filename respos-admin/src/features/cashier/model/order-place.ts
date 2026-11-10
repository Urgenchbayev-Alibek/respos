import type { TFunction } from 'i18next';
import type { OrderType } from '@/entities/order/order.types';

/** «Стол 5» / «Доставка» / «С собой» — the one place label of the payable list, the payment panel and the pre-check. */
export function orderPlaceLabel(order: { tableNumber: string | null; type: OrderType }, t: TFunction<'cashier'>): string {
  if (order.tableNumber) return t('orders.table', { number: order.tableNumber });
  return order.type === 'delivery' ? t('orders.delivery') : t('orders.takeaway');
}
