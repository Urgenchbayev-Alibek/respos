import { z } from 'zod';
import { emailSchema, passwordSchema, phoneSchema, requiredString, V } from '@/shared/lib/validation';

export type UserFormMode = 'invite' | 'create' | 'edit';

const base = {
  fullName: requiredString(150),
  phone: phoneSchema,
  roleIds: z.array(z.string()).min(1, V.selectAtLeastOne),
  branchIds: z.array(z.string()),
};

export const inviteUserSchema = z.object({ ...base, email: emailSchema });
export const createUserSchema = z.object({ ...base, email: emailSchema, password: passwordSchema });
export const editUserSchema = z.object(base);

/** One form shape for all modes; unused fields stay empty strings. */
export interface UserFormValues {
  email: string;
  fullName: string;
  phone: string;
  password: string;
  roleIds: string[];
  branchIds: string[];
}

export function schemaForMode(mode: UserFormMode) {
  if (mode === 'create') return createUserSchema;
  if (mode === 'invite') return inviteUserSchema;
  return editUserSchema;
}
