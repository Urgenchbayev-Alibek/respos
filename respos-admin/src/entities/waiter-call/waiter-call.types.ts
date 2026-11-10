import type { Guid, Iso8601 } from '@/shared/types/api-response';

export type WaiterCallReason = 'call' | 'bill';

/** `GET /waiter-calls` item: a guest pressed a button on the table QR menu. */
export interface WaiterCallDto {
  id: Guid;
  tableId: Guid;
  tableNumber: string;
  reason: WaiterCallReason;
  status: 'active' | 'acknowledged';
  createdAt: Iso8601;
  acknowledgedAt: Iso8601 | null;
  acknowledgedBy: Guid | null;
  acknowledgedByName: string | null;
}
