import type { TableStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';

/** `GET /tables` item (respos-contracts/ENDPOINTS.md "Floor"). */
export interface TableDto {
  id: Guid;
  number: string;
  capacity: number;
  areaId: Guid;
  areaName: string;
  status: TableStatus;
  isActive: boolean;
  posX: number | null;
  posY: number | null;
  activeOrderId: Guid | null;
  activeOrderTotal: number | null;
  /** Next confirmed reservation today (DECISIONS_v1_1 §12). */
  nextReservation: { id: Guid; startsAt: Iso8601; guestName: string } | null;
}

export interface TableListParams {
  areaId?: string;
  status?: TableStatus;
}

export interface TableInput {
  number: string;
  capacity: number;
  areaId: string;
  posX: number | null;
  posY: number | null;
  isActive: boolean;
}

/** Manual status change: occupied/reserved are set by orders/reservations. */
export type ManualTableStatus = 'available' | 'unavailable';

/** Natural sort by table number ("2" < "10" < "VIP-1"). */
export function compareTableNumbers(a: Pick<TableDto, 'number'>, b: Pick<TableDto, 'number'>): number {
  return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' });
}
