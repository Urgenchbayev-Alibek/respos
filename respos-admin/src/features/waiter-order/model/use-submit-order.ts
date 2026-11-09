import { useState } from 'react';
import { useAddOrderItems, useCreateOrder, useSendToKitchen } from '@/entities/order/order.queries';
import type { OrderDto, OrderType } from '@/entities/order/order.types';
import { useIdempotencyKey } from '@/shared/api/idempotency';
import { toAddItems, type CartLine } from './cart';

export interface NewOrderDraft {
  type: OrderType;
  tableId?: string;
  guestCount: number;
}

export interface SubmitResult {
  orderId: string | null;
  error: unknown;
}

/**
 * "Send to kitchen" flow: create the order (new) or add the cart items (existing), then
 * `POST /orders/{id}/send-to-kitchen` with ONE Idempotency-Key per user action — reused on retry,
 * renewed after success. Items reach the server before sending, so a retry only repeats the send.
 */
export function useSubmitOrder(orderId: string | undefined, draft: NewOrderDraft | null) {
  const create = useCreateOrder();
  const addItems = useAddOrderItems();
  const send = useSendToKitchen();
  const { key, renew } = useIdempotencyKey();
  const [createdId, setCreatedId] = useState<string | null>(null);

  const submit = async (lines: CartLine[], onItemsSaved: (order: OrderDto) => void): Promise<SubmitResult> => {
    let id = orderId ?? createdId;
    try {
      if (lines.length > 0) {
        let order: OrderDto;
        if (id) {
          order = await addItems.mutateAsync({ orderId: id, items: toAddItems(lines) });
        } else {
          if (!draft) throw new Error('Order draft is missing');
          order = await create.mutateAsync({ ...draft, items: toAddItems(lines) });
          id = order.id;
          setCreatedId(order.id);
        }
        onItemsSaved(order);
      }
      if (!id) return { orderId: null, error: null };
      await send.mutateAsync({ orderId: id, idempotencyKey: key });
      renew();
      return { orderId: id, error: null };
    } catch (error) {
      return { orderId: id, error };
    }
  };

  return {
    submit,
    isPending: create.isPending || addItems.isPending || send.isPending,
    createdId,
    idempotencyKey: key,
  };
}
