import { z } from 'zod';
import { MANUAL_MOVEMENT_TYPES } from '@/entities/stock/stock.types';
import { UNIT_KINDS } from '@/entities/unit/unit.types';
import { optionalMoneyTextSchema, quantitySchema } from '@/shared/lib/quantity';
import { optionalString, requiredString, V } from '@/shared/lib/validation';

/** Receipt / write-off take a positive quantity; adjustment is signed (+ found, − lost). */
export const movementSchema = z
  .object({
    ingredientId: z.string().min(1, V.required),
    type: z.enum(MANUAL_MOVEMENT_TYPES),
    quantity: quantitySchema({ signed: true }),
    unitId: z.string(),
    unitCost: optionalMoneyTextSchema,
    reason: requiredString(500),
  })
  .superRefine((value, ctx) => {
    if (value.type !== 'adjustment' && value.quantity < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: V.positive });
    }
  });

export interface MovementFormValues {
  ingredientId: string;
  type: (typeof MANUAL_MOVEMENT_TYPES)[number];
  quantity: string;
  unitId: string;
  unitCost: string;
  reason: string;
}
export type MovementFormOutput = z.output<typeof movementSchema>;

export const ingredientSchema = z.object({
  name: requiredString(150),
  sku: optionalString(50),
  categoryId: z.string(),
  baseUnitId: z.string().min(1, V.required),
  costPrice: optionalMoneyTextSchema,
  defaultSupplierId: z.string(),
});

export interface IngredientFormValues {
  name: string;
  sku: string;
  categoryId: string;
  baseUnitId: string;
  costPrice: string;
  defaultSupplierId: string;
}
export type IngredientFormOutput = z.output<typeof ingredientSchema>;

export const minQuantitySchema = z.object({ minQuantity: quantitySchema({ allowZero: true }) });
export type MinQuantityOutput = z.output<typeof minQuantitySchema>;

export const unitSchema = z.object({
  code: requiredString(10),
  name: requiredString(50),
  kind: z.enum(UNIT_KINDS),
});

export const conversionSchema = z
  .object({
    fromUnitId: z.string().min(1, V.required),
    toUnitId: z.string().min(1, V.required),
    factor: quantitySchema(),
  })
  .refine((value) => value.fromUnitId !== value.toUnitId, { path: ['toUnitId'], message: 'stock:units.sameUnit' });
export type ConversionOutput = z.output<typeof conversionSchema>;
