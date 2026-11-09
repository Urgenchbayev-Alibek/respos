import type { PayableOrderSummary } from '@/entities/payment/payable-order.types';

/** Orders the cashier can take money for: not paid/cancelled and something left to pay. */
export function filterPayableOrders(orders: PayableOrderSummary[], search: string): PayableOrderSummary[] {
  const term = search.trim().toLowerCase().replace(/^#/, '');
  return orders
    .filter((order) => order.status !== 'paid' && order.status !== 'cancelled' && order.remainingAmount > 0)
    .filter((order) => {
      if (!term) return true;
      const number = String(order.number);
      return (
        number === term.replace(/^0+/, '') ||
        number.padStart(4, '0').includes(term) ||
        (order.tableNumber ?? '').toLowerCase() === term
      );
    });
}
