import { z } from 'zod';

/**
 * Common zod schemas. Messages are i18n KEYS in the `validation` namespace;
 * <FormField> translates them, so schemas stay language-independent.
 */
export const V = {
  required: 'validation:required',
  email: 'validation:email',
  passwordPolicy: 'validation:passwordPolicy',
  passwordsMismatch: 'validation:passwordsMismatch',
  phone: 'validation:phone',
  percent: 'validation:percent',
  positive: 'validation:positive',
  nonNegative: 'validation:nonNegative',
  moneyPrecision: 'validation:moneyPrecision',
  maxLength: 'validation:maxLength',
  selectAtLeastOne: 'validation:selectAtLeastOne',
} as const;

export const requiredString = (max = 200) => z.string().trim().min(1, V.required).max(max, V.maxLength);

export const optionalString = (max = 500) =>
  z.string().trim().max(max, V.maxLength).optional().or(z.literal('')).transform((v) => (v ? v : undefined));

export const emailSchema = z.string().trim().min(1, V.required).email(V.email).max(254, V.maxLength);

/** Contract password policy: min 8 chars, at least 1 letter and 1 digit. */
export const passwordSchema = z
  .string()
  .min(8, V.passwordPolicy)
  .max(128, V.maxLength)
  .regex(/\p{L}/u, V.passwordPolicy)
  .regex(/\d/, V.passwordPolicy);

/** Uzbek and international numbers: optional +, 7–15 digits, spaces/dashes/brackets allowed. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[\d\s\-()]{7,20}$/, V.phone)
  .optional()
  .or(z.literal(''))
  .transform((v) => (v ? v : undefined));

export const percentSchema = z.coerce.number({ invalid_type_error: V.percent }).min(0, V.percent).max(100, V.percent);

export const moneySchema = z.coerce
  .number({ invalid_type_error: V.nonNegative })
  .min(0, V.nonNegative)
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(String(v)), V.moneyPrecision);

export const guidArraySchema = z.array(z.string().uuid()).min(1, V.selectAtLeastOne);
