import { z } from 'zod';
import { SUBSCRIPTION_STATUSES } from '@/shared/constants/statuses';
import { emailSchema, passwordSchema, requiredString, V } from '@/shared/lib/validation';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createOrganizationSchema = z.object({
  name: requiredString(200),
  slug: z.string().trim().min(1, V.required).max(60, V.maxLength).regex(SLUG_PATTERN, V.slug),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, 'platform:validation.currency'),
  branchName: requiredString(150),
  planCode: z.string().min(1, V.required),
  ownerFullName: requiredString(150),
  ownerEmail: emailSchema,
  ownerPassword: passwordSchema,
});
export type CreateOrganizationValues = z.infer<typeof createOrganizationSchema>;

/** Suggests a slug from the organization name (latin only; user can edit). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, 60);
}

export const subscriptionSchema = z.object({
  planCode: z.string().min(1, V.required),
  status: z.enum(SUBSCRIPTION_STATUSES),
  endsAt: z.string(),
});
export type SubscriptionValues = z.infer<typeof subscriptionSchema>;

const limit = z.coerce.number({ invalid_type_error: V.positive }).int(V.positive).min(1, V.positive).max(100000, V.positive);

export const planSchema = z.object({
  code: z.string().trim().min(1, V.required).max(50, V.maxLength).regex(SLUG_PATTERN, V.slug),
  name: requiredString(100),
  maxBranches: limit,
  maxUsers: limit,
  isActive: z.boolean(),
  features: z.array(z.string()),
});
export type PlanOutput = z.output<typeof planSchema>;

export const BREAK_GLASS_MIN_REASON = 10;
export const breakGlassSchema = z.object({
  reason: z.string().trim().min(BREAK_GLASS_MIN_REASON, 'platform:access.reasonTooShort').max(500, V.maxLength),
});
