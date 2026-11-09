import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useResetPassword } from '@/features/auth/api/auth.api';
import { resetPasswordSchema, type ResetPasswordValues } from '@/features/auth/model/auth-schemas';
import { ROUTES } from '@/shared/constants/routes';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Input } from '@/shared/ui';
import { AuthCard } from './AuthCard';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const mutation = useResetPassword();
  const { register, handleSubmit, formState } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const footer = <Link to={ROUTES.login}>{t('auth:backToLogin')}</Link>;
  if (!token) {
    return (
      <AuthCard title={t('auth:reset.title')} footer={footer}>
        <Alert>{t('auth:invalidLink')}</Alert>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('auth:reset.title')} subtitle={t('auth:passwordPolicy')} footer={footer}>
      {mutation.isSuccess ? (
        <Alert tone="success">{t('auth:reset.done')}</Alert>
      ) : (
        <FormGrid onSubmit={handleSubmit(({ newPassword }) => mutation.mutate({ token, newPassword }))}>
          {mutation.isError && <Alert>{getErrorMessage(mutation.error, t)}</Alert>}
          <FormField label={t('auth:fields.newPassword')} error={formState.errors.newPassword?.message} required>
            <Input type="password" autoComplete="new-password" autoFocus {...register('newPassword')} />
          </FormField>
          <FormField label={t('auth:fields.confirmPassword')} error={formState.errors.confirmPassword?.message} required>
            <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
          </FormField>
          <Button type="submit" variant="primary" size="lg" fullWidth loading={mutation.isPending}>
            {t('auth:reset.submit')}
          </Button>
        </FormGrid>
      )}
    </AuthCard>
  );
}
