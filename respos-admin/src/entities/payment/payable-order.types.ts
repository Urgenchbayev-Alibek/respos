import type { OrderDto } from '@/entities/order/order.types';

/**
 * The cashier works on the real OrderDto (`GET /orders/active` and `GET /orders/{id}` both return full
 * OrderDto); these aliases keep the cashier vocabulary. All money values are server-calculated.
 */
export type PayableOrderSummary = OrderDto;
export type PayableOrderDto = OrderDto;
export type PayableOrderItem = OrderDto['items'][number];
