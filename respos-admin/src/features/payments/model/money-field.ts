import { z } from 'zod';
import { V } from '@/shared/lib/validation';

/**
 * Money value from <MoneyInput> (number | null) with UI limits. Mirrors contract rules for instant
 * feedback only — the server validates again and its result wins.
 */
export function moneyField(options: { positive?: boolean; max?: number; maxMessage?: string; optional?: boolean } = {}) {
  return z
    .number({ invalid_type_error: V.required })
    .nullable()
    .superRefine((value, ctx) => {
      if (value === null) {
        if (!options.optional) ctx.addIssue({ code: z.ZodIssueCode.custom, message: V.required });
        return;
      }
      if (options.positive ? value <= 0 : value < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: options.positive ? V.positive : V.nonNegative });
      } else if (options.max !== undefined && value > options.max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: options.maxMessage ?? V.positive });
      }
    });
}
