import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useDeliverySettings, useSaveDeliverySettings } from '@/entities/delivery/delivery.queries';
import { env } from '@/shared/config/env';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { moneySchema, V } from '@/shared/lib/validation';
import { Alert, Button, Card, ErrorState, FormActions, FormField, FormGrid, Input, MoneyInput, Spinner, useToast } from '@/shared/ui';

const schema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, V.slug)
    .max(64, V.slug)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, V.slug),
  deliveryFee: moneySchema,
});
type Values = z.input<typeof schema>;

/** Branch settings section: public QR-menu address (slug) + delivery fee. */
export function DeliverySettingsCard({ branchId }: { branchId: string }) {
  const settings = useDeliverySettings(branchId);
  if (settings.isLoading) return <Spinner />;
  if (settings.error) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;
  if (!settings.data) return null;
  return <DeliverySettingsForm key={settings.data.slug ?? ''} branchId={branchId} slug={settings.data.slug ?? ''} fee={settings.data.deliveryFee} />;
}

function DeliverySettingsForm({ branchId, slug, fee }: { branchId: string; slug: string; fee: number }) {
  const { t } = useTranslation('delivery');
  const toast = useToast();
  const save = useSaveDeliverySettings(branchId);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, control, handleSubmit, setError, reset, watch, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { slug, deliveryFee: fee },
  });
  const currentSlug = watch('slug');
  const menuUrl = `${env.landingUrl}/menu/${encodeURIComponent(slug)}`;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const saved = await save.mutateAsync(schema.parse(values));
      reset({ slug: saved.slug ?? '', deliveryFee: saved.deliveryFee });
      toast.success(t('settings.saved'));
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['slug', 'deliveryFee'])) setServerError(getErrorMessage(error, t));
    }
  });

  return (
    <Card title={t('settings.title')}>
      <FormGrid columns={2} onSubmit={onSubmit}>
        {serverError && <div data-span="full"><Alert>{serverError}</Alert></div>}
        <FormField label={t('settings.slug')} error={formState.errors.slug?.message} hint={t('settings.slugHint', { slug: currentSlug || '…' })}>
          <Input autoComplete="off" spellCheck={false} {...register('slug')} />
        </FormField>
        <FormField label={t('settings.fee')} error={formState.errors.deliveryFee?.message} hint={t('settings.feeHint')}>
          <Controller
            control={control}
            name="deliveryFee"
            render={({ field }) => <MoneyInput value={Number(field.value ?? 0)} onChange={(v) => field.onChange(v ?? 0)} />}
          />
        </FormField>
        {slug && (
          <div data-span="full">
            <a href={menuUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={14} aria-hidden="true" /> {t('settings.openMenu')}
            </a>
          </div>
        )}
        <FormActions>
          <Button type="submit" variant="primary" loading={formState.isSubmitting} disabled={!formState.isDirty}>
            {t('common:actions.save')}
          </Button>
        </FormActions>
      </FormGrid>
    </Card>
  );
}
