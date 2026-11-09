import { z } from 'zod';
import type { PurchaseDto, PurchaseInput } from '@/entities/purchase/purchase.types';
import { toBranchDateString } from '@/shared/lib/format-date';
import { parseDecimal, quantitySchema } from '@/shared/lib/quantity';
import { optionalString, V } from '@/shared/lib/validation';
import { zonedToUtcIso } from '@/shared/lib/zoned-time';

const priceSchema = z.preprocess(
  (value) => (value === '' ? undefined : (parseDecimal(value) ?? Number.NaN)),
  z
    .number({ required_error: V.required, invalid_type_error: V.nonNegative })
    .refine((v) => !Number.isNaN(v) && v >= 0, V.nonNegative)
    .refine((v) => Number.isInteger(Math.round(v * 100)) && Math.abs(Math.round(v * 100) - v * 100) < 1e-6, V.moneyPrecision),
);

export const purchaseSchema = z.object({
  supplierId: z.string().min(1, V.required),
  expectedAt: z.string(),
  comment: optionalString(500),
  items: z
    .array(
      z.object({
        ingredientId: z.string().min(1, V.required),
        quantity: quantitySchema(),
        unitId: z.string().min(1, V.required),
        unitPrice: priceSchema,
      }),
    )
    .min(1, V.selectAtLeastOne),
});

export type PurchaseFormOutput = z.output<typeof purchaseSchema>;

export interface PurchaseLineValues {
  ingredientId: string;
  quantity: string;
  unitId: string;
  unitPrice: string;
}

export interface PurchaseFormValues {
  supplierId: string;
  expectedAt: string;
  comment: string;
  items: PurchaseLineValues[];
}

export const EMPTY_PURCHASE_LINE: PurchaseLineValues = { ingredientId: '', quantity: '', unitId: '', unitPrice: '' };

/** `expectedAt` is a backend DateTime: the date input (branch timezone) ↔ UTC instant at local midnight. */
export function toPurchaseFormValues(purchase: PurchaseDto | null | undefined, timeZone: string): PurchaseFormValues {
  return {
    supplierId: purchase?.supplierId ?? '',
    expectedAt: purchase?.expectedAt ? toBranchDateString(purchase.expectedAt, timeZone) : '',
    comment: purchase?.comment ?? '',
    items: purchase?.items?.length
      ? purchase.items.map((item) => ({
          ingredientId: item.ingredientId,
          quantity: String(item.quantity),
          unitId: item.unitId,
          unitPrice: String(item.unitPrice),
        }))
      : [EMPTY_PURCHASE_LINE],
  };
}

export function toPurchaseInput(values: PurchaseFormOutput, timeZone: string): PurchaseInput {
  return {
    supplierId: values.supplierId,
    expectedAt: values.expectedAt ? zonedToUtcIso(values.expectedAt, '00:00', timeZone) || undefined : undefined,
    comment: values.comment,
    items: values.items,
  };
}
