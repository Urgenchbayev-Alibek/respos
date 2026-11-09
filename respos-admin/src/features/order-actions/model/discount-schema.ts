import { z } from 'zod';
import { DISCOUNT_TYPES, type ApplyDiscountInput } from '@/entities/order/order.types';
import { V } from '@/shared/lib/validation';

/**
 * Discount form. Mirrors the server rules for instant feedback only (percent 0–100, reason required unless
 * `none`); "amount ≤ subtotal / total ≥ paid" is checked by the server (`order.invalid_discount`).
 */
export const discountSchema = z
  .object({
    type: z.enum(DISCOUNT_TYPES),
    value: z.number({ invalid_type_error: V.required }).nullable(),
    reason: z.string().max(500, V.maxLength),
  })
  .superRefine((values, ctx) => {
    if (values.type === 'none') return;
    if (values.value === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: V.required });
    } else if (values.value <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: V.positive });
    } else if (values.type === 'percent' && values.value > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: V.percent });
    }
    if (values.reason.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: V.required });
    }
  });

export type DiscountFormValues = z.infer<typeof discountSchema>;

export function toDiscountInput(values: DiscountFormValues): ApplyDiscountInput {
  return values.type === 'none'
    ? { type: 'none', value: 0, reason: values.reason.trim() }
    : { type: values.type, value: values.value ?? 0, reason: values.reason.trim() };
}
