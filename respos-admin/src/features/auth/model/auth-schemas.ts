import { z } from 'zod';
import { emailSchema, passwordSchema, requiredString, V } from '@/shared/lib/validation';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, V.required),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

const withConfirmation = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object({ ...shape, newPassword: passwordSchema, confirmPassword: z.string().min(1, V.required) })
    .refine((values) => values.newPassword === values.confirmPassword, {
      path: ['confirmPassword'],
      message: V.passwordsMismatch,
    });

export const resetPasswordSchema = withConfirmation({});
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const acceptInvitationSchema = withConfirmation({ fullName: requiredString(150) });
export type AcceptInvitationValues = z.infer<typeof acceptInvitationSchema>;

export const changePasswordSchema = withConfirmation({ currentPassword: z.string().min(1, V.required) });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
