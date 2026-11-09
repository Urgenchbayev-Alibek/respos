import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { usePlans, useUpdateSubscription } from '@/entities/platform/platform.queries';
import type { PlatformOrganizationDto } from '@/entities/platform/platform.types';
import { SUBSCRIPTION_STATUSES } from '@/shared/constants/statuses';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Input, Modal, Select, useToast } from '@/shared/ui';
import { subscriptionSchema, type SubscriptionValues } from '../model/platform-schemas';

export function SubscriptionModal({ organization, onClose }: { organization: PlatformOrganizationDto | null; onClose: () => void }) {
  const { t } = useTranslation('platform');
  const toast = useToast();
  const plans = usePlans(organization !== null);
  const update = useUpdateSubscription();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<SubscriptionValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: { planCode: '', status: 'active', endsAt: '' },
  });

  useEffect(() => {
    if (!organization) return;
    reset({
      planCode: organization.planCode ?? '',
      status: organization.subscriptionStatus ?? 'active',
      // PlatformOrganizationDto carries no subscription end date: the field starts empty.
      endsAt: '',
    });
    setServerError(null);
  }, [organization, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!organization) return;
    try {
      await update.mutateAsync({ id: organization.id, input: { ...values, endsAt: values.endsAt || null } });
      toast.success(t('subscription.saved'));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['planCode', 'status', 'endsAt'])) setServerError(getErrorMessage(error, t));
    }
  });

  return (
    <Modal
      open={organization !== null}
      onClose={onClose}
      size="sm"
      title={t('subscription.title')}
      description={organization?.name}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" type="submit" form="subscription-form" loading={formState.isSubmitting}>{t('common:actions.save')}</Button>
        </>
      }
    >
      <FormGrid id="subscription-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('fields.plan')} error={formState.errors.planCode?.message} required>
          <Select
            placeholder={t('fields.selectPlan')}
            options={(plans.data ?? []).map((plan) => ({ value: plan.code, label: plan.name }))}
            data-autofocus
            {...register('planCode')}
          />
        </FormField>
        <FormField label={t('fields.subscriptionStatus')} error={formState.errors.status?.message} required>
          <Select options={SUBSCRIPTION_STATUSES.map((status) => ({ value: status, label: t(`status:subscription.${status}`) }))} {...register('status')} />
        </FormField>
        <FormField label={t('fields.endsAt')} error={formState.errors.endsAt?.message}>
          <Input type="date" {...register('endsAt')} />
        </FormField>
      </FormGrid>
    </Modal>
  );
}
