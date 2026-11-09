import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSaveDiningArea } from '@/entities/dining-area/dining-area.queries';
import type { DiningAreaDto } from '@/entities/dining-area/dining-area.types';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Input, Modal, Switch, useToast } from '@/shared/ui';
import { areaSchema, type AreaFormOutput, type AreaFormValues } from '../model/floor-schemas';

export interface AreaFormModalProps {
  area: DiningAreaDto | null;
  nextSortOrder: number;
  onClose: () => void;
}

export function AreaFormModal({ area, nextSortOrder, onClose }: AreaFormModalProps) {
  const { t } = useTranslation('floor');
  const toast = useToast();
  const save = useSaveDiningArea();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, control, handleSubmit, setError, formState } = useForm<AreaFormValues, unknown, AreaFormOutput>({
    resolver: zodResolver(areaSchema),
    defaultValues: { name: area?.name ?? '', sortOrder: area?.sortOrder ?? nextSortOrder, isActive: area?.isActive ?? true },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await save.mutateAsync({ id: area?.id, input: values });
      toast.success(t('toast.areaSaved'));
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
      title={t(area ? 'form.editArea' : 'form.createArea')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button type="submit" form="area-form" variant="primary" loading={formState.isSubmitting}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <FormGrid id="area-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('fields.name')} error={formState.errors.name?.message} required>
          <Input data-autofocus {...register('name')} />
        </FormField>
        <FormField label={t('fields.sortOrder')} error={formState.errors.sortOrder?.message}>
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
