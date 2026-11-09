import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { DiningAreaDto } from '@/entities/dining-area/dining-area.types';
import { useSaveTable } from '@/entities/table/table.queries';
import type { TableDto } from '@/entities/table/table.types';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Input, Modal, Select, Switch, useToast } from '@/shared/ui';
import { tableSchema, type TableFormOutput, type TableFormValues } from '../model/floor-schemas';

export interface TableFormModalProps {
  table: TableDto | null;
  areas: DiningAreaDto[];
  defaultAreaId?: string;
  onClose: () => void;
}

const FIELDS = ['number', 'capacity', 'areaId', 'posX', 'posY', 'isActive'] as const;

export function TableFormModal({ table, areas, defaultAreaId, onClose }: TableFormModalProps) {
  const { t } = useTranslation('floor');
  const toast = useToast();
  const save = useSaveTable();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, control, handleSubmit, setError, formState } = useForm<TableFormValues, unknown, TableFormOutput>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      number: table?.number ?? '',
      capacity: table?.capacity ?? 4,
      areaId: table?.areaId ?? defaultAreaId ?? areas[0]?.id ?? '',
      posX: table?.posX === null || table?.posX === undefined ? '' : String(table.posX),
      posY: table?.posY === null || table?.posY === undefined ? '' : String(table.posY),
      isActive: table?.isActive ?? true,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await save.mutateAsync({ id: table?.id, input: values });
      toast.success(t('toast.tableSaved'));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, FIELDS)) setServerError(getErrorMessage(error, t));
    }
  });

  const errors = formState.errors;
  return (
    <Modal
      open
      onClose={onClose}
      title={t(table ? 'form.editTable' : 'form.createTable')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button type="submit" form="table-form" variant="primary" loading={formState.isSubmitting}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <FormGrid id="table-form" columns={2} onSubmit={onSubmit}>
        {serverError && (
          <div data-span="full">
            <Alert>{serverError}</Alert>
          </div>
        )}
        <FormField label={t('fields.number')} error={errors.number?.message} required>
          <Input data-autofocus {...register('number')} />
        </FormField>
        <FormField label={t('fields.capacity')} error={errors.capacity?.message} required>
          <Input type="number" inputMode="numeric" min={1} max={100} {...register('capacity')} />
        </FormField>
        <div data-span="full">
          <FormField label={t('fields.area')} error={errors.areaId?.message} required>
            <Select
              placeholder={t('fields.areaPlaceholder')}
              options={areas.map((area) => ({ value: area.id, label: area.name }))}
              {...register('areaId')}
            />
          </FormField>
        </div>
        <FormField label={t('fields.posX')} error={errors.posX?.message} hint={t('fields.posHint')}>
          <Input inputMode="numeric" {...register('posX')} />
        </FormField>
        <FormField label={t('fields.posY')} error={errors.posY?.message}>
          <Input inputMode="numeric" {...register('posY')} />
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
