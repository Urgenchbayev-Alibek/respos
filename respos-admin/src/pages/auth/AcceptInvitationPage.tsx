import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useAcceptInvitation } from '@/features/auth/api/auth.api';
import { acceptInvitationSchema, type AcceptInvitationValues } from '@/features/auth/model/auth-schemas';
import { ROUTES } from '@/shared/constants/routes';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Input } from '@/shared/ui';
import { AuthCard } from './AuthCard';

export function AcceptInvitationPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const mutation = useAcceptInvitation();
  const { register, handleSubmit, formState } = useForm<AcceptInvitationValues>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { fullName: '', newPassword: '', confirmPassword: '' },
  });
  const errors = formState.errors;
  const footer = <Link to={ROUTES.login}>{t('auth:backToLogin')}</Link>;

  if (!token) {
    return (
      <AuthCard title={t('auth:invitation.title')} footer={footer}>
        <Alert>{t('auth:invalidLink')}</Alert>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('auth:invitation.title')} subtitle={t('auth:invitation.subtitle')} footer={footer}>
      {mutation.isSuccess ? (
        <Alert tone="success">{t('auth:invitation.done')}</Alert>
      ) : (
        <FormGrid
          onSubmit={handleSubmit(({ fullName, newPassword }) => mutation.mutate({ token, fullName, password: newPassword }))}
        >
          {mutation.isError && <Alert>{getErrorMessage(mutation.error, t)}</Alert>}
          <FormField label={t('auth:fields.fullName')} error={errors.fullName?.message} required>
            <Input autoComplete="name" autoFocus {...register('fullName')} />
          </FormField>
          <FormField label={t('auth:fields.newPassword')} error={errors.newPassword?.message} hint={t('auth:passwordPolicy')} required>
            <Input type="password" autoComplete="new-password" {...register('newPassword')} />
          </FormField>
          <FormField label={t('auth:fields.confirmPassword')} error={errors.confirmPassword?.message} required>
            <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
          </FormField>
          <Button type="submit" variant="primary" size="lg" fullWidth loading={mutation.isPending}>
            {t('auth:invitation.submit')}
          </Button>
        </FormGrid>
      )}
    </AuthCard>
  );
}
