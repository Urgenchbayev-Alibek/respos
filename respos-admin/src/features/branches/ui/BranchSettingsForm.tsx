import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useSaveBranchSettings } from '@/entities/branch/branch.queries';
import type { BranchSettingsDto } from '@/entities/branch/branch.types';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { percentSchema, V } from '@/shared/lib/validation';
import { Alert, Button, Card, FormActions, FormField, FormGrid, Input, Switch, Textarea, useToast } from '@/shared/ui';

const settingsSchema = z.object({
  serviceChargePercent: percentSchema,
  taxPercent: percentSchema,
  allowNegativeStock: z.boolean(),
  receiptFooter: z.string().max(500, V.maxLength),
});
type SettingsValues = z.input<typeof settingsSchema>;
const FIELDS = ['serviceChargePercent', 'taxPercent', 'allowNegativeStock', 'receiptFooter'] as const;

/** Service charge %, tax %, negative stock, receipt footer. Calculation itself is server-side. */
export function BranchSettingsForm({ branchId, settings }: { branchId: string; settings: BranchSettingsDto }) {
  const { t } = useTranslation('branches');
  const toast = useToast();
  const save = useSaveBranchSettings(branchId);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, control, handleSubmit, setError, reset, formState } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { ...settings, receiptFooter: settings.receiptFooter ?? '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const saved = await save.mutateAsync(settingsSchema.parse(values));
      reset({ ...saved, receiptFooter: saved.receiptFooter ?? '' });
      toast.success(t('settings.saved'));
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, FIELDS)) setServerError(getErrorMessage(error, t));
    }
  });

  const errors = formState.errors;
  return (
    <Card>
      <FormGrid columns={2} onSubmit={onSubmit}>
        {serverError && <div data-span="full"><Alert>{serverError}</Alert></div>}
        <FormField label={t('settings.serviceCharge')} error={errors.serviceChargePercent?.message} hint={t('settings.percentHint')}>
          <Input type="number" inputMode="decimal" min={0} max={100} step="0.01" {...register('serviceChargePercent')} />
        </FormField>
        <FormField label={t('settings.tax')} error={errors.taxPercent?.message} hint={t('settings.taxHint')}>
          <Input type="number" inputMode="decimal" min={0} max={100} step="0.01" {...register('taxPercent')} />
        </FormField>
        <div data-span="full">
          <Controller
            control={control}
            name="allowNegativeStock"
            render={({ field }) => (
              <Switch checked={field.value} onChange={field.onChange} label={t('settings.allowNegativeStock')} />
            )}
          />
          <p>
            <small>{t('settings.allowNegativeStockHint')}</small>
          </p>
        </div>
        <div data-span="full">
          <FormField label={t('settings.receiptFooter')} error={errors.receiptFooter?.message} hint={t('settings.receiptFooterHint')}>
            <Textarea rows={3} maxLength={500} {...register('receiptFooter')} />
          </FormField>
        </div>
        <FormActions>
          <Button type="submit" variant="primary" loading={formState.isSubmitting} disabled={!formState.isDirty}>
            {t('common:actions.save')}
          </Button>
        </FormActions>
      </FormGrid>
    </Card>
  );
}
