import { z } from 'zod';
import type { ReservationDto, ReservationInput } from '@/entities/reservation/reservation.types';
import { addMinutesToTime, utcToZonedParts, zonedToUtcIso } from '@/shared/lib/zoned-time';
import { optionalString, requiredString, V } from '@/shared/lib/validation';

export const RESERVATION_V = {
  guestCount: 'reservations:validation.guestCount',
  endAfterStart: 'reservations:validation.endAfterStart',
} as const;

export const DEFAULT_START_TIME = '19:00';
export const DEFAULT_DURATION_MINUTES = 120;

export const reservationSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, V.required),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, V.required),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, V.required),
    guestName: requiredString(150),
    /** Backend requires a phone (SaveReservationValidator: NotEmpty + ValidPhone). */
    guestPhone: z.string().trim().min(1, V.required).regex(/^\+?[\d\s\-()]{7,20}$/, V.phone),
    guestCount: z.coerce
      .number({ invalid_type_error: RESERVATION_V.guestCount })
      .int(RESERVATION_V.guestCount)
      .min(1, RESERVATION_V.guestCount)
      .max(200, RESERVATION_V.guestCount),
    tableId: z.string(),
    preferredAreaId: z.string(),
    comment: optionalString(500),
  })
  .refine((values) => values.endTime > values.startTime, { path: ['endTime'], message: RESERVATION_V.endAfterStart });

export type ReservationFormValues = z.input<typeof reservationSchema>;
export type ReservationFormOutput = z.output<typeof reservationSchema>;
export const RESERVATION_FIELDS = [
  'date',
  'startTime',
  'endTime',
  'guestName',
  'guestPhone',
  'guestCount',
  'tableId',
  'preferredAreaId',
  'comment',
] as const;

export function toFormValues(reservation: ReservationDto | null, date: string, timeZone: string): ReservationFormValues {
  if (!reservation) {
    return {
      date,
      startTime: DEFAULT_START_TIME,
      endTime: addMinutesToTime(DEFAULT_START_TIME, DEFAULT_DURATION_MINUTES),
      guestName: '',
      guestPhone: '',
      guestCount: 2,
      tableId: '',
      preferredAreaId: '',
      comment: '',
    };
  }
  const start = utcToZonedParts(reservation.startsAt, timeZone);
  const end = utcToZonedParts(reservation.endsAt, timeZone);
  return {
    date: start?.date ?? date,
    startTime: start?.time ?? DEFAULT_START_TIME,
    endTime: end?.time ?? addMinutesToTime(start?.time ?? DEFAULT_START_TIME, DEFAULT_DURATION_MINUTES),
    guestName: reservation.guestName,
    guestPhone: reservation.guestPhone,
    guestCount: reservation.guestCount,
    tableId: reservation.tableId ?? '',
    preferredAreaId: reservation.preferredAreaId ?? '',
    comment: reservation.comment ?? '',
  };
}

export function toReservationInput(values: ReservationFormOutput, timeZone: string): ReservationInput {
  return {
    tableId: values.tableId || undefined,
    preferredAreaId: values.preferredAreaId || undefined,
    guestName: values.guestName,
    guestPhone: values.guestPhone,
    guestCount: values.guestCount,
    startsAt: zonedToUtcIso(values.date, values.startTime, timeZone),
    endsAt: zonedToUtcIso(values.date, values.endTime, timeZone),
    comment: values.comment,
  };
}

const ACTIVE = new Set(['pending', 'confirmed', 'seated']);

/** Active reservations of the same table overlapping `[startsAt, endsAt)` (used to highlight a 409 conflict). */
export function findOverlapping(
  reservations: ReservationDto[],
  probe: { id?: string; tableId?: string; startsAt: string; endsAt: string },
): ReservationDto[] {
  if (!probe.tableId) return [];
  const start = Date.parse(probe.startsAt);
  const end = Date.parse(probe.endsAt);
  return reservations.filter(
    (other) =>
      other.id !== probe.id &&
      other.tableId === probe.tableId &&
      ACTIVE.has(other.status) &&
      Date.parse(other.startsAt) < end &&
      start < Date.parse(other.endsAt),
  );
}
