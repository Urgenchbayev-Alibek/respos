import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useChangePassword } from '@/features/auth/api/auth.api';
import { changePasswordSchema, type ChangePasswordValues } from '@/features/auth/model/auth-schemas';
import { MyPinCard, MyScheduleCard } from '@/features/staff/ui/ProfileStaffCards';
import { LANGUAGES, type Language } from '@/shared/constants/locale';
import { useCurrentUser } from '@/shared/hooks/use-auth';
import { changeLanguage } from '@/shared/i18n';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, Card, FormActions, FormField, FormGrid, Input, PageHeader, Select, useToast } from '@/shared/ui';
import styles from './ProfilePage.module.css';

const EMPTY: ChangePasswordValues = { currentPassword: '', newPassword: '', confirmPassword: '' };

export function ProfilePage() {
  const { t, i18n } = useTranslation('profile');
  const user = useCurrentUser();
  const toast = useToast();
  const mutation = useChangePassword();
  const { register, handleSubmit, reset, setError, formState } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await mutation.mutateAsync({ currentPassword, newPassword });
      reset(EMPTY);
      toast.success(t('password.changed'));
    } catch (error) {
      applyServerFieldErrors(error, setError, ['currentPassword', 'newPassword']);
    }
  });

  const errors = formState.errors;
  return (
    <div className={styles.page}>
      <PageHeader title={t('title')} description={`${user.fullName} · ${user.email}`} />
      <div className={styles.stack}>
        <Card title={t('language.title')}>
          <FormField label={t('language.label')} hint={t('language.hint')}>
            <Select
              value={i18n.language}
              onChange={(event) => void changeLanguage(event.target.value as Language)}
              options={LANGUAGES.map((lang) => ({ value: lang, label: t(`common:languages.${lang}`) }))}
            />
          </FormField>
        </Card>
        <Card title={t('password.title')}>
          <FormGrid onSubmit={onSubmit}>
            {mutation.isError && <Alert>{getErrorMessage(mutation.error, t)}</Alert>}
            <FormField label={t('password.current')} error={errors.currentPassword?.message} required>
              <Input type="password" autoComplete="current-password" {...register('currentPassword')} />
            </FormField>
            <FormField label={t('password.new')} error={errors.newPassword?.message} hint={t('auth:passwordPolicy')} required>
              <Input type="password" autoComplete="new-password" {...register('newPassword')} />
            </FormField>
            <FormField label={t('password.confirm')} error={errors.confirmPassword?.message} required>
              <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
            </FormField>
            <FormActions>
              <Button type="submit" variant="primary" loading={formState.isSubmitting}>
                {t('password.submit')}
              </Button>
            </FormActions>
          </FormGrid>
        </Card>
        <MyPinCard />
        <MyScheduleCard />
      </div>
    </div>
  );
}
