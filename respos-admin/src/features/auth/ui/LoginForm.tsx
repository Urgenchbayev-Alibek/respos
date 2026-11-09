import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/shared/constants/routes';
import { useAuth } from '@/shared/hooks/use-auth';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Input } from '@/shared/ui';
import { loginSchema, type LoginValues } from '../model/auth-schemas';

export interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login(values);
      onSuccess();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['email', 'password'])) setServerError(getErrorMessage(error, t));
    }
  });

  return (
    <FormGrid onSubmit={onSubmit} aria-label={t('auth:login.title')}>
      {serverError && <Alert>{serverError}</Alert>}
      <FormField label={t('auth:fields.email')} error={errors.email?.message} required>
        <Input type="email" autoComplete="username" inputMode="email" autoFocus {...register('email')} />
      </FormField>
      <FormField label={t('auth:fields.password')} error={errors.password?.message} required>
        <Input type="password" autoComplete="current-password" {...register('password')} />
      </FormField>
      <Link to={ROUTES.forgotPassword}>{t('auth:login.forgotPassword')}</Link>
      <Button type="submit" variant="primary" size="lg" fullWidth loading={isSubmitting}>
        {t('auth:login.submit')}
      </Button>
    </FormGrid>
  );
}
