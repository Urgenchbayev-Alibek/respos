/** Server → client events (respos-contracts/REALTIME.md). Payloads are hints; always refetch via REST. */
interface BaseEvent {
  branchId: string;
  occurredAt: string;
}

export interface RealtimeEventMap {
  KitchenTicketCreated: BaseEvent & { ticketId: string; orderId: string; stationId: string; tableLabel: string; createdAt: string };
  KitchenTicketUpdated: BaseEvent & { ticketId: string; orderId: string; stationId: string; status: string };
  OrderUpdated: BaseEvent & { orderId: string; status: string; tableId: string | null };
  OrderItemReady: BaseEvent & { orderId: string; orderItemId: string; tableId: string | null; itemName: string };
  TableUpdated: BaseEvent & { tableId: string; status: string };
  PaymentRegistered: BaseEvent & { orderId: string; paymentId: string; amount: number };
  NotificationCreated: BaseEvent & { notificationId: string; type: string; title: string };
  StockLow: BaseEvent & { ingredientId: string; name: string; quantity: number; minQuantity: number };
  DeliveryUpdated: BaseEvent & { orderId: string; status: string; courierId: string | null };
  WaiterCalled: BaseEvent & { callId: string; tableId: string; tableNumber: string; reason: 'call' | 'bill' };
  WaiterCallUpdated: BaseEvent & { callId: string; tableId: string; status: string };
}

export type RealtimeEventName = keyof RealtimeEventMap;

export const REALTIME_EVENTS = [
  'KitchenTicketCreated',
  'KitchenTicketUpdated',
  'OrderUpdated',
  'OrderItemReady',
  'TableUpdated',
  'PaymentRegistered',
  'NotificationCreated',
  'StockLow',
  'DeliveryUpdated',
  'WaiterCalled',
  'WaiterCallUpdated',
] as const satisfies readonly RealtimeEventName[];

/** Client → server hub methods. */
export const HUB_METHODS = {
  joinBranch: 'JoinBranch',
  joinKitchenStation: 'JoinKitchenStation',
  leaveKitchenStation: 'LeaveKitchenStation',
} as const;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
