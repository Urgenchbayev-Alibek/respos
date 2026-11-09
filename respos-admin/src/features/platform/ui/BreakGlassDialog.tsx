import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTenantAccess } from '@/entities/platform/platform.queries';
import type { PlatformOrganizationDto } from '@/entities/platform/platform.types';
import { sessionStore } from '@/shared/api/session-store';
import { ROUTES } from '@/shared/constants/routes';
import { useAuth } from '@/shared/hooks/use-auth';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Modal, Textarea } from '@/shared/ui';
import { breakGlassSchema } from '../model/platform-schemas';
import styles from './platform.module.css';

/**
 * Break-glass tenant access: mandatory reason, audited server-side. The returned short-lived (30 min)
 * read-only token replaces the in-memory access token; when it expires the normal refresh restores
 * the platform session.
 */
export function BreakGlassDialog({ organization, onClose }: { organization: PlatformOrganizationDto | null; onClose: () => void }) {
  const { t } = useTranslation('platform');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { reloadUser } = useAuth();
  const access = useTenantAccess();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<{ reason: string }>({
    resolver: zodResolver(breakGlassSchema),
    defaultValues: { reason: '' },
  });

  useEffect(() => {
    reset({ reason: '' });
    setServerError(null);
  }, [organization, reset]);

  const onSubmit = handleSubmit(async ({ reason }) => {
    if (!organization) return;
    setServerError(null);
    try {
      const result = await access.mutateAsync({ id: organization.id, reason });
      sessionStore.setAccessToken(result.accessToken);
      sessionStore.setBranchId(null);
      queryClient.clear();
      await reloadUser();
      onClose();
      navigate(ROUTES.admin.root);
    } catch (error) {
      setServerError(getErrorMessage(error, t));
    }
  });

  return (
    <Modal
      open={organization !== null}
      onClose={onClose}
      title={t('access.title', { name: organization?.name ?? '' })}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose} disabled={formState.isSubmitting}>{t('common:actions.cancel')}</Button>
          <Button variant="danger" type="submit" form="break-glass-form" loading={formState.isSubmitting}>{t('access.submit')}</Button>
        </>
      }
    >
      <FormGrid id="break-glass-form" onSubmit={onSubmit}>
        <div className={styles.warning} role="note">
          <ShieldAlert aria-hidden="true" />
          <p>{t('access.warning')}</p>
        </div>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('access.reason')} error={formState.errors.reason?.message} hint={t('access.reasonHint')} required>
          <Textarea maxLength={500} data-autofocus {...register('reason')} />
        </FormField>
      </FormGrid>
    </Modal>
  );
}
