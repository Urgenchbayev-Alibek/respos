import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useOpenShift } from '@/entities/cash-shift/cash-shift.queries';
import { moneyField } from '@/features/payments/model/money-field';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Modal, MoneyInput, useToast } from '@/shared/ui';

const openSchema = z.object({ openingAmount: moneyField() });
type OpenValues = z.input<typeof openSchema>;

export function OpenShiftModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('cashier');
  const format = useFormatters();
  const toast = useToast();
  const open = useOpenShift();
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm<OpenValues>({
    resolver: zodResolver(openSchema),
    defaultValues: { openingAmount: null },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await open.mutateAsync({ openingAmount: values.openingAmount ?? 0 });
      toast.success(t('shift.openedToast'));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['openingAmount'])) setServerError(getErrorMessage(error, t));
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t('shift.openTitle')}
      description={t('shift.openDescription')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose} disabled={formState.isSubmitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form="open-shift-form" variant="primary" loading={formState.isSubmitting}>
            {t('shift.open')}
          </Button>
        </>
      }
    >
      <FormGrid id="open-shift-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('shift.openingAmount')} error={formState.errors.openingAmount?.message} required>
          <Controller
            control={control}
            name="openingAmount"
            render={({ field }) => (
              <MoneyInput data-autofocus value={field.value} onChange={field.onChange} onBlur={field.onBlur} currency={format.currency} />
            )}
          />
        </FormField>
      </FormGrid>
    </Modal>
  );
}
