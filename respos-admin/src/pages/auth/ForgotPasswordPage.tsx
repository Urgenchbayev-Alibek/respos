import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useForgotPassword } from '@/features/auth/api/auth.api';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/features/auth/model/auth-schemas';
import { ROUTES } from '@/shared/constants/routes';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Input } from '@/shared/ui';
import { AuthCard } from './AuthCard';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const mutation = useForgotPassword();
  const { register, handleSubmit, formState } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  return (
    <AuthCard
      title={t('auth:forgot.title')}
      subtitle={t('auth:forgot.subtitle')}
      footer={<Link to={ROUTES.login}>{t('auth:backToLogin')}</Link>}
    >
      {mutation.isSuccess ? (
        <Alert tone="success">{t('auth:forgot.sent')}</Alert>
      ) : (
        <FormGrid onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          {mutation.isError && <Alert>{getErrorMessage(mutation.error, t)}</Alert>}
          <FormField label={t('auth:fields.email')} error={formState.errors.email?.message} required>
            <Input type="email" autoComplete="email" autoFocus {...register('email')} />
          </FormField>
          <Button type="submit" variant="primary" size="lg" fullWidth loading={mutation.isPending}>
            {t('auth:forgot.submit')}
          </Button>
        </FormGrid>
      )}
    </AuthCard>
  );
}
