import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useIngredientCategories, useSaveIngredient } from '@/entities/ingredient/ingredient.queries';
import type { IngredientDto } from '@/entities/ingredient/ingredient.types';
import { useSupplierOptions } from '@/entities/supplier/supplier.queries';
import { unitOptions, useUnits } from '@/entities/unit/unit.queries';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Input, Modal, Select, useToast } from '@/shared/ui';
import { ingredientSchema, type IngredientFormOutput, type IngredientFormValues } from '../model/stock-schemas';

export interface IngredientFormModalProps {
  open: boolean;
  ingredient?: IngredientDto | null;
  onClose: () => void;
}

const FIELDS = ['name', 'sku', 'categoryId', 'baseUnitId', 'costPrice', 'defaultSupplierId'] as const;

function initialValues(ingredient?: IngredientDto | null): IngredientFormValues {
  return {
    name: ingredient?.name ?? '',
    sku: ingredient?.sku ?? '',
    categoryId: ingredient?.categoryId ?? '',
    baseUnitId: ingredient?.baseUnitId ?? '',
    costPrice: ingredient ? String(ingredient.costPrice) : '',
    defaultSupplierId: ingredient?.defaultSupplierId ?? '',
  };
}

export function IngredientFormModal({ open, ingredient, onClose }: IngredientFormModalProps) {
  const { t } = useTranslation('stock');
  const toast = useToast();
  const format = useFormatters();
  const categories = useIngredientCategories();
  const units = useUnits();
  const suppliers = useSupplierOptions(open);
  const save = useSaveIngredient();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<IngredientFormValues, unknown, IngredientFormOutput>({
    resolver: zodResolver(ingredientSchema) as unknown as Resolver<IngredientFormValues>,
    defaultValues: initialValues(ingredient),
  });
  const { register, handleSubmit, reset, setError, formState } = form;

  useEffect(() => {
    if (open) {
      reset(initialValues(ingredient));
      setServerError(null);
    }
  }, [open, ingredient, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await save.mutateAsync({
        id: ingredient?.id,
        input: {
          ...values,
          categoryId: values.categoryId || null,
          defaultSupplierId: values.defaultSupplierId || null,
          costPrice: values.costPrice ?? 0,
        },
      });
      toast.success(t(ingredient ? 'ingredients.updated' : 'ingredients.created'));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, FIELDS)) setServerError(getErrorMessage(error, t));
    }
  });

  const errors = formState.errors;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(ingredient ? 'ingredients.editTitle' : 'ingredients.createTitle')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose} disabled={formState.isSubmitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="primary" type="submit" form="ingredient-form" loading={formState.isSubmitting}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <FormGrid id="ingredient-form" columns={2} onSubmit={onSubmit}>
        {serverError && <div data-span="full"><Alert>{serverError}</Alert></div>}
        <FormField label={t('fields.name')} error={errors.name?.message} required>
          <Input autoComplete="off" data-autofocus {...register('name')} />
        </FormField>
        <FormField label={t('fields.sku')} error={errors.sku?.message}>
          <Input autoComplete="off" {...register('sku')} />
        </FormField>
        <FormField label={t('fields.category')} error={errors.categoryId?.message}>
          <Select
            placeholder={t('fields.noCategory')}
            options={(categories.data ?? []).map((category) => ({ value: category.id, label: category.name }))}
            {...register('categoryId')}
          />
        </FormField>
        <FormField
          label={t('fields.baseUnit')}
          error={errors.baseUnitId?.message}
          hint={ingredient ? t('ingredients.baseUnitLocked') : undefined}
          required
        >
          <Select
            placeholder={t('fields.selectUnit')}
            disabled={Boolean(ingredient)}
            options={unitOptions(units.data)}
            {...register('baseUnitId')}
          />
        </FormField>
        <FormField label={t('fields.costPrice', { currency: format.currency })} error={errors.costPrice?.message}>
          <Input inputMode="decimal" autoComplete="off" {...register('costPrice')} />
        </FormField>
        <FormField label={t('fields.defaultSupplier')} error={errors.defaultSupplierId?.message}>
          <Select
            placeholder={t('fields.noSupplier')}
            options={(suppliers.data?.items ?? []).map((supplier) => ({ value: supplier.id, label: supplier.name }))}
            {...register('defaultSupplierId')}
          />
        </FormField>
      </FormGrid>
    </Modal>
  );
}
