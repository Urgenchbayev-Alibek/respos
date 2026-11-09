import type { ReservationStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

/** TableReservation (branch-scoped), backend `ReservationDto`. */
export interface ReservationDto {
  id: Guid;
  tableId: Guid | null;
  tableNumber: string | null;
  preferredAreaId: Guid | null;
  guestName: string;
  guestPhone: string;
  guestCount: number;
  startsAt: Iso8601;
  endsAt: Iso8601;
  comment: string | null;
  status: ReservationStatus;
  cancelReason: string | null;
  createdAt: Iso8601;
}

export interface ReservationListParams extends PageParams {
  /** `YYYY-MM-DD` in branch timezone */
  date?: string;
  /** ISO 8601 UTC instants */
  from?: string;
  to?: string;
  /** Single status (backend binds one enum value, no comma list). */
  status?: ReservationStatus;
  tableId?: string;
}

export interface ReservationInput {
  tableId?: string;
  preferredAreaId?: string;
  guestName: string;
  guestPhone: string;
  guestCount: number;
  startsAt: Iso8601;
  endsAt: Iso8601;
  comment?: string;
}

export type ReservationAction = 'confirm' | 'seat' | 'complete' | 'cancel' | 'no-show';

/**
 * Which actions to offer per status — mirrors backend `ReservationRules.Transitions`
 * (pending → confirmed|cancelled|no_show; confirmed → seated|cancelled|no_show; seated → completed).
 */
export const RESERVATION_ACTIONS: Record<ReservationStatus, ReservationAction[]> = {
  pending: ['confirm', 'cancel', 'no-show'],
  confirmed: ['seat', 'cancel', 'no-show'],
  seated: ['complete'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export const EDITABLE_RESERVATION_STATUSES: readonly ReservationStatus[] = ['pending', 'confirmed'];
