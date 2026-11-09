import { z } from 'zod';
import { requiredString, V } from '@/shared/lib/validation';

export const FLOOR_V = {
  capacity: 'floor:validation.capacity',
  position: 'floor:validation.position',
  sortOrder: 'floor:validation.sortOrder',
} as const;

/** Optional grid cell (0–99) entered as text; '' → null. */
const optionalCell = z
  .string()
  .trim()
  .regex(/^\d{0,2}$/, FLOOR_V.position)
  .transform((value) => (value === '' ? null : Number(value)));

export const tableSchema = z.object({
  number: requiredString(20),
  capacity: z.coerce
    .number({ invalid_type_error: FLOOR_V.capacity })
    .int(FLOOR_V.capacity)
    .min(1, FLOOR_V.capacity)
    .max(100, FLOOR_V.capacity),
  areaId: z.string().min(1, V.required),
  posX: optionalCell,
  posY: optionalCell,
  isActive: z.boolean(),
});
export type TableFormValues = z.input<typeof tableSchema>;
export type TableFormOutput = z.output<typeof tableSchema>;

export const areaSchema = z.object({
  name: requiredString(100),
  sortOrder: z.coerce
    .number({ invalid_type_error: FLOOR_V.sortOrder })
    .int(FLOOR_V.sortOrder)
    .min(0, FLOOR_V.sortOrder)
    .max(9999, FLOOR_V.sortOrder),
  isActive: z.boolean(),
});
export type AreaFormValues = z.input<typeof areaSchema>;
export type AreaFormOutput = z.output<typeof areaSchema>;
