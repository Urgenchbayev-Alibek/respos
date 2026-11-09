import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useSaveKitchenStation } from '@/entities/kitchen-station/kitchen-station.queries';
import type { KitchenStationDto } from '@/entities/kitchen-station/kitchen-station.types';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { requiredString } from '@/shared/lib/validation';
import { Alert, Button, FormField, FormGrid, Input, Modal, Switch, useToast } from '@/shared/ui';

const SORT_ORDER_ERROR = 'kitchenStations:validation.sortOrder';

const stationSchema = z.object({
  name: requiredString(100),
  sortOrder: z.coerce
    .number({ invalid_type_error: SORT_ORDER_ERROR })
    .int(SORT_ORDER_ERROR)
    .min(0, SORT_ORDER_ERROR)
    .max(9999, SORT_ORDER_ERROR),
  isActive: z.boolean(),
});
type StationValues = z.input<typeof stationSchema>;
type StationOutput = z.output<typeof stationSchema>;

export interface StationFormModalProps {
  station: KitchenStationDto | null;
  nextSortOrder: number;
  onClose: () => void;
}

export function StationFormModal({ station, nextSortOrder, onClose }: StationFormModalProps) {
  const { t } = useTranslation('kitchenStations');
  const toast = useToast();
  const save = useSaveKitchenStation();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, control, handleSubmit, setError, formState } = useForm<StationValues, unknown, StationOutput>({
    resolver: zodResolver(stationSchema),
    defaultValues: {
      name: station?.name ?? '',
      sortOrder: station?.sortOrder ?? nextSortOrder,
      isActive: station?.isActive ?? true,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await save.mutateAsync({ id: station?.id, input: values });
      toast.success(t('toast.saved'));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['name', 'sortOrder'])) setServerError(getErrorMessage(error, t));
    }
  });

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={t(station ? 'form.editTitle' : 'form.createTitle')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button type="submit" form="station-form" variant="primary" loading={formState.isSubmitting}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <FormGrid id="station-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('fields.name')} error={formState.errors.name?.message} required>
          <Input data-autofocus {...register('name')} />
        </FormField>
        <FormField label={t('fields.sortOrder')} error={formState.errors.sortOrder?.message} hint={t('fields.sortOrderHint')}>
          <Input type="number" inputMode="numeric" min={0} {...register('sortOrder')} />
        </FormField>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label={t('fields.isActive')} />}
        />
      </FormGrid>
    </Modal>
  );
}
