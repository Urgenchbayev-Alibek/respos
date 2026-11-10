import { z } from 'zod';
import { optionalString, requiredString, V } from '@/shared/lib/validation';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Mirrors the server PIN policy (ADR-0014): 4–6 digits, not all equal, not an ascending/descending run. */
export function isStrongPin(pin: string): boolean {
  if (!/^\d{4,6}$/.test(pin)) return false;
  const digits = [...pin].map(Number);
  const steps = digits.slice(1).map((digit, index) => digit - (digits[index] ?? 0));
  const allSame = steps.every((step) => step === 0);
  const ascending = steps.every((step) => step === 1);
  const descending = steps.every((step) => step === -1);
  return !allSame && !ascending && !descending;
}

export const pinSchema = z.string().refine(isStrongPin, 'staff:validation.pinWeak');

export const myPinSchema = z
  .object({ currentPassword: requiredString(128), pin: pinSchema, confirmPin: z.string() })
  .refine((values) => values.pin === values.confirmPin, { path: ['confirmPin'], message: 'staff:validation.pinMismatch' });
export type MyPinValues = z.input<typeof myPinSchema>;

export const memberPinSchema = z.object({ pin: pinSchema });
export type MemberPinValues = z.input<typeof memberPinSchema>;

export const timeEntrySchema = z.object({
  userId: z.string().min(1, V.required),
  inDate: z.string().regex(DATE, V.required),
  inTime: z.string().regex(TIME, V.required),
  outDate: z.string(),
  outTime: z.string(),
  breakMinutes: z.coerce.number({ invalid_type_error: V.nonNegative }).int(V.nonNegative).min(0, V.nonNegative).max(1440, V.maxLength),
  note: optionalString(500),
  reason: requiredString(500),
});
export type TimeEntryValues = z.input<typeof timeEntrySchema>;
export type TimeEntryOutput = z.output<typeof timeEntrySchema>;

export const shiftSchema = z
  .object({
    userId: z.string().min(1, V.required),
    date: z.string().regex(DATE, V.required),
    startTime: z.string().regex(TIME, V.required),
    endTime: z.string().regex(TIME, V.required),
    roleNote: optionalString(64),
    note: optionalString(500),
  })
  .refine((values) => values.startTime !== values.endTime, { path: ['endTime'], message: 'staff:validation.shiftSameTime' });
export type ShiftValues = z.input<typeof shiftSchema>;
export type ShiftOutput = z.output<typeof shiftSchema>;

export const deviceSchema = z.object({ name: requiredString(100) });
export type DeviceValues = z.input<typeof deviceSchema>;
