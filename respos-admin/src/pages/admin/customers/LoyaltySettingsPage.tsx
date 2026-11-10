import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useLoyaltySettings, useSaveLoyaltySettings } from '@/entities/customer/customer.queries';
import type { LoyaltySettingsDto } from '@/entities/customer/customer.types';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { moneySchema, percentSchema, V } from '@/shared/lib/validation';
import { Alert, Button, Card, ErrorState, FormActions, FormField, FormGrid, Input, MoneyInput, PageHeader, PageLoader, Switch, useToast } from '@/shared/ui';

const schema = z.object({
  isEnabled: z.boolean(),
  earnPercent: percentSchema,
  maxRedeemPercent: percentSchema,
  minOrderAmount: moneySchema,
  pointsExpiryDays: z.union([
    z.literal('').transform(() => null),
    z.coerce.number({ invalid_type_error: V.positive }).int(V.positive).min(1, V.positive).max(3650, V.positive),
  ]),
});
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;
const FIELDS = ['earnPercent', 'maxRedeemPercent', 'minOrderAmount', 'pointsExpiryDays'] as const;

function toValues(s?: LoyaltySettingsDto): Values {
  return {
    isEnabled: s?.isEnabled ?? false,
    earnPercent: s?.earnPercent ?? 5,
    maxRedeemPercent: s?.maxRedeemPercent ?? 30,
    minOrderAmount: s?.minOrderAmount ?? 0,
    pointsExpiryDays: s?.pointsExpiryDays ?? '',
  };
}

/** Admin → Guests → loyalty program settings (org-wide; 1 point = 1 currency unit). */
export function LoyaltySettingsPage() {
  const { t } = useTranslation('customers');
  const toast = useToast();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.customers.manage);
  const query = useLoyaltySettings();
  const save = useSaveLoyaltySettings();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset, setError, formState } = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: toValues(),
  });

  useEffect(() => {
    if (query.data) reset(toValues(query.data));
  }, [query.data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await save.mutateAsync(values);
      toast.success(t('loyalty.saved'));
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, FIELDS)) setServerError(getErrorMessage(error, t));
    }
  });

  if (query.isPending) return <PageLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const errors = formState.errors;
  return (
    <>
      <Button variant="ghost" icon={<ArrowLeft />} onClick={() => navigate(ROUTES.admin.customers)}>{t('detail.back')}</Button>
      <PageHeader title={t('loyalty.title')} description={t('loyalty.subtitle')} />
      <Card>
        <FormGrid id="loyalty-form" columns={2} onSubmit={onSubmit}>
          {serverError && <div data-span="full"><Alert>{serverError}</Alert></div>}
          <div data-span="full">
            <Controller
              control={control}
              name="isEnabled"
              render={({ field }) => (
                <Switch label={t('loyalty.enabled')} checked={field.value} disabled={!canManage} onChange={field.onChange} />
              )}
            />
          </div>
          <FormField label={t('loyalty.earnPercent')} error={errors.earnPercent?.message} hint={t('loyalty.earnHint')}>
            <Input type="number" step="0.01" min={0} max={100} disabled={!canManage} {...register('earnPercent')} />
          </FormField>
          <FormField label={t('loyalty.maxRedeemPercent')} error={errors.maxRedeemPercent?.message} hint={t('loyalty.maxRedeemHint')}>
            <Input type="number" step="0.01" min={0} max={100} disabled={!canManage} {...register('maxRedeemPercent')} />
          </FormField>
          <FormField label={t('loyalty.minOrderAmount')} error={errors.minOrderAmount?.message}>
            <Controller
              control={control}
              name="minOrderAmount"
              render={({ field }) => (
                <MoneyInput value={Number(field.value)} onChange={(value) => field.onChange(value ?? 0)} disabled={!canManage} />
              )}
            />
          </FormField>
          <FormField label={t('loyalty.expiryDays')} error={errors.pointsExpiryDays?.message} hint={t('loyalty.expiryHint')}>
            <Input type="number" step={1} min={1} disabled={!canManage} {...register('pointsExpiryDays')} />
          </FormField>
          {canManage && (
            <FormActions>
              <Button variant="primary" type="submit" loading={formState.isSubmitting}>{t('common:actions.save')}</Button>
            </FormActions>
          )}
        </FormGrid>
      </Card>
    </>
  );
}
