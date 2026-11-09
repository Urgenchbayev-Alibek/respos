import type { ReservationStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

/** TableReservation (branch-scoped). `tableNumber` is optional: the UI falls back to the tables list. */
export interface ReservationDto {
  id: Guid;
  tableId: Guid | null;
  tableNumber?: string | null;
  preferredAreaId: Guid | null;
  guestName: string;
  guestPhone: string | null;
  guestCount: number;
  startsAt: Iso8601;
  endsAt: Iso8601;
  comment: string | null;
  status: ReservationStatus;
}

export interface ReservationListParams extends PageParams {
  /** `YYYY-MM-DD` in branch timezone */
  date?: string;
  from?: string;
  to?: string;
  status?: ReservationStatus;
  tableId?: string;
}

export interface ReservationInput {
  tableId?: string;
  preferredAreaId?: string;
  guestName: string;
  guestPhone?: string;
  guestCount: number;
  startsAt: Iso8601;
  endsAt: Iso8601;
  comment?: string;
}

export type ReservationAction = 'confirm' | 'seat' | 'complete' | 'cancel' | 'no-show';

/** Which actions to offer per status (the server validates transitions; this only hides buttons). */
export const RESERVATION_ACTIONS: Record<ReservationStatus, ReservationAction[]> = {
  pending: ['confirm', 'seat', 'cancel', 'no-show'],
  confirmed: ['seat', 'cancel', 'no-show'],
  seated: ['complete'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export const EDITABLE_RESERVATION_STATUSES: readonly ReservationStatus[] = ['pending', 'confirmed'];
