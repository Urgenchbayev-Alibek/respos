import { z } from 'zod';
import { normalizePhone } from '@/shared/lib/phone';
import { optionalString, requiredString, V } from '@/shared/lib/validation';

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
