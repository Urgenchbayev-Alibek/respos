import { z } from 'zod';
import { optionalString, requiredString, V } from '@/shared/lib/validation';

/** Same rule as the server: 9 local digits, 998 + 9 digits, or +<8–15 digits> (spaces, dashes, brackets allowed). */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || !/^\+?[\d\s\-()]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  const international = trimmed.startsWith('+');
  if (!international && digits.length === 9) return `+998${digits}`;
  if (digits.startsWith('998')) return digits.length === 12 ? `+${digits}` : null;
  return international && digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

export const deliveryPhoneSchema = z
  .string()
  .trim()
  .min(1, V.required)
  .refine((value) => normalizePhone(value) !== null, V.phone);

export const deliveryDetailsSchema = z.object({
  customerName: requiredString(200),
  customerPhone: deliveryPhoneSchema,
  address: requiredString(500),
  entrance: optionalString(32),
  floor: optionalString(32),
  apartment: optionalString(32),
  comment: optionalString(1000),
  courierId: z.string().optional(),
});

export type DeliveryDetailsValues = z.input<typeof deliveryDetailsSchema>;

export const DELIVERY_DETAIL_FIELDS = [
  'customerName',
  'customerPhone',
  'address',
  'entrance',
  'floor',
  'apartment',
  'comment',
  'courierId',
] as const;

/** Minutes elapsed since an ISO instant (board timers). */
export function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}
