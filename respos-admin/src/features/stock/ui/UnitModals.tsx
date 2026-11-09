import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { unitOptions, useCreateUnit, useCreateUnitConversion, useUnits } from '@/entities/unit/unit.queries';
import { UNIT_KINDS, type UnitKind } from '@/entities/unit/unit.types';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Input, Modal, Select, useToast } from '@/shared/ui';
import { conversionSchema, unitSchema, type ConversionOutput } from '../model/stock-schemas';

interface ModalProps {
  open: boolean;
  onClose: () => void;
}

type UnitValues = z.infer<typeof unitSchema>;

export function UnitFormModal({ open, onClose }: ModalProps) {
  const { t } = useTranslation('stock');
  const toast = useToast();
  const create = useCreateUnit();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<UnitValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: { code: '', name: '', kind: 'mass' },
  });
  useEffect(() => {
    if (open) {
      reset({ code: '', name: '', kind: 'mass' });
      setServerError(null);
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync(values);
      toast.success(t('units.created'));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['code', 'name', 'kind'])) setServerError(getErrorMessage(error, t));
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t('units.createTitle')}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" type="submit" form="unit-form" loading={formState.isSubmitting}>{t('common:actions.save')}</Button>
        </>
      }
    >
      <FormGrid id="unit-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('fields.unitCode')} error={formState.errors.code?.message} required>
          <Input autoComplete="off" data-autofocus {...register('code')} />
        </FormField>
        <FormField label={t('fields.name')} error={formState.errors.name?.message} required>
          <Input autoComplete="off" {...register('name')} />
        </FormField>
        <FormField label={t('fields.unitKind')} error={formState.errors.kind?.message} required>
          <Select options={UNIT_KINDS.map((kind: UnitKind) => ({ value: kind, label: t(`unitKind.${kind}`) }))} {...register('kind')} />
        </FormField>
      </FormGrid>
    </Modal>
  );
}

interface ConversionValues {
  fromUnitId: string;
  toUnitId: string;
  factor: string;
}

/** 1 {from} = factor × {to} (e.g. 1 kg = 1000 g). */
export function ConversionFormModal({ open, onClose }: ModalProps) {
  const { t } = useTranslation('stock');
  const toast = useToast();
  const units = useUnits();
  const create = useCreateUnitConversion();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<ConversionValues, unknown, ConversionOutput>({
    resolver: zodResolver(conversionSchema) as unknown as Resolver<ConversionValues>,
    defaultValues: { fromUnitId: '', toUnitId: '', factor: '' },
  });
  useEffect(() => {
    if (open) {
      reset({ fromUnitId: '', toUnitId: '', factor: '' });
      setServerError(null);
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync(values);
      toast.success(t('units.conversionCreated'));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['fromUnitId', 'toUnitId', 'factor'])) setServerError(getErrorMessage(error, t));
    }
  });

  const options = unitOptions(units.data);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t('units.conversionTitle')}
      description={t('units.conversionHint')}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" type="submit" form="conversion-form" loading={formState.isSubmitting}>{t('common:actions.save')}</Button>
        </>
      }
    >
      <FormGrid id="conversion-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('fields.fromUnit')} error={formState.errors.fromUnitId?.message} required>
          <Select placeholder={t('fields.selectUnit')} options={options} data-autofocus {...register('fromUnitId')} />
        </FormField>
        <FormField label={t('fields.factor')} error={formState.errors.factor?.message} required>
          <Input inputMode="decimal" autoComplete="off" {...register('factor')} />
        </FormField>
        <FormField label={t('fields.toUnit')} error={formState.errors.toUnitId?.message} required>
          <Select placeholder={t('fields.selectUnit')} options={options} {...register('toUnitId')} />
        </FormField>
      </FormGrid>
    </Modal>
  );
}
