import { z } from 'zod';
import { V } from './validation';

/** Whitespace incl. no-break / narrow no-break spaces produced by Intl number formatting. */
const NBSP_OR_SPACE = new RegExp('[\\s\\u00A0\\u202F]', 'g');

/** Parses "12,5" / "12.5" / " 1 200,25 " into a number; empty or invalid input → undefined. */
export function parseDecimal(input: unknown): number | undefined {
  if (typeof input === 'number') return Number.isFinite(input) ? input : undefined;
  if (typeof input !== 'string') return undefined;
  const cleaned = input.replace(NBSP_OR_SPACE, '').replace(',', '.');
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

const hasMaxDecimals = (value: number, digits: number) => Math.abs(Math.round(value * 10 ** digits) - value * 10 ** digits) < 1e-6;

export interface QuantityRules {
  /** Allow negative values (signed adjustments). Default false. */
  signed?: boolean;
  /** Allow zero (counted quantity). Default false. */
  allowZero?: boolean;
}

/** Quantity field (contract: decimal(18,3)). Accepts the raw input string, outputs a number. */
export function quantitySchema({ signed = false, allowZero = false }: QuantityRules = {}) {
  return z.preprocess(
    (value) => (value === '' || value === null ? undefined : (parseDecimal(value) ?? Number.NaN)),
    z
      .number({ required_error: V.required, invalid_type_error: V.quantity })
      .refine((v) => !Number.isNaN(v), V.quantity)
      .refine((v) => hasMaxDecimals(v, 3), V.quantity)
      .refine((v) => signed || v >= 0, V.nonNegative)
      .refine((v) => allowZero || v !== 0, signed ? V.nonZero : V.positive),
  );
}

/** Optional money amount as text input (≤ 2 decimals, ≥ 0). Empty → undefined. */
export const optionalMoneyTextSchema = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : (parseDecimal(value) ?? Number.NaN)),
  z
    .number({ invalid_type_error: V.nonNegative })
    .refine((v) => !Number.isNaN(v) && v >= 0, V.nonNegative)
    .refine((v) => hasMaxDecimals(v, 2), V.moneyPrecision)
    .optional(),
);
