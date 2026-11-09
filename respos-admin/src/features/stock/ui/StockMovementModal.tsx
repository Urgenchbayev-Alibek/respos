import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useIngredientOptions } from '@/entities/ingredient/ingredient.queries';
import type { IngredientDto } from '@/entities/ingredient/ingredient.types';
import { useCreateMovement } from '@/entities/stock/stock.queries';
import { MANUAL_MOVEMENT_TYPES, type ManualMovementType } from '@/entities/stock/stock.types';
import { unitOptions, useUnits } from '@/entities/unit/unit.queries';
import { isApiError } from '@/shared/api/api-error';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Input, Modal, Select, Textarea, useToast } from '@/shared/ui';
import { movementSchema, type MovementFormOutput, type MovementFormValues } from '../model/stock-schemas';
import styles from './stock.module.css';

export interface StockMovementModalProps {
  open: boolean;
  onClose: () => void;
  /** Preselected ingredient (row action). Without it the user picks one. */
  ingredient?: IngredientDto | null;
  defaultType?: ManualMovementType;
}

const FIELDS = ['ingredientId', 'type', 'quantity', 'unitId', 'unitCost', 'reason'] as const;

/** Receipt / write-off / adjustment with mandatory reason. 409 `stock.insufficient` is shown at the quantity field. */
export function StockMovementModal({ open, onClose, ingredient, defaultType = 'write_off' }: StockMovementModalProps) {
  const { t } = useTranslation('stock');
  const toast = useToast();
  const format = useFormatters();
  const ingredients = useIngredientOptions(open && !ingredient);
  const units = useUnits();
  const create = useCreateMovement();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<MovementFormValues, unknown, MovementFormOutput>({
    resolver: zodResolver(movementSchema) as unknown as Resolver<MovementFormValues>,
    defaultValues: { ingredientId: '', type: defaultType, quantity: '', unitId: '', unitCost: '', reason: '' },
  });
  const { register, handleSubmit, reset, setError, control, formState } = form;
  const [type, ingredientId] = useWatch({ control, name: ['type', 'ingredientId'] });

  useEffect(() => {
    if (!open) return;
    reset({ ingredientId: ingredient?.id ?? '', type: defaultType, quantity: '', unitId: '', unitCost: '', reason: '' });
    setServerError(null);
  }, [open, ingredient, defaultType, reset]);

  const selected = ingredient ?? ingredients.data?.items.find((item) => item.id === ingredientId) ?? null;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await create.mutateAsync({
        ingredientId: values.ingredientId,
        type: values.type,
        quantity: values.quantity,
        unitId: values.unitId || undefined,
        unitCost: values.type === 'receipt' ? values.unitCost : undefined,
        reason: values.reason,
      });
      toast.success(t('movement.saved'));
      onClose();
    } catch (error) {
      if (isApiError(error) && error.code === 'stock.insufficient') {
        setError('quantity', { type: 'server', message: 'errors:stock.insufficient' });
        return;
      }
      if (!applyServerFieldErrors(error, setError, FIELDS)) setServerError(getErrorMessage(error, t));
    }
  });

  const errors = formState.errors;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(`movement.title.${type}`)}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose} disabled={formState.isSubmitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="primary" type="submit" form="stock-movement-form" loading={formState.isSubmitting}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <FormGrid id="stock-movement-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('fields.ingredient')} error={errors.ingredientId?.message} required>
          <Select
            placeholder={t('fields.selectIngredient')}
            disabled={Boolean(ingredient)}
            options={
              ingredient
                ? [{ value: ingredient.id, label: ingredient.name }]
                : (ingredients.data?.items ?? []).map((item) => ({ value: item.id, label: item.name }))
            }
            {...register('ingredientId')}
          />
        </FormField>
        {selected && (
          <div className={styles.hint}>
            <span>{t('movement.currentBalance')}</span>
            <strong>
              {format.number(selected.quantity)} {selected.baseUnitCode}
            </strong>
          </div>
        )}
        <FormField label={t('fields.movementType')} error={errors.type?.message} required>
          <Select
            options={MANUAL_MOVEMENT_TYPES.map((value) => ({ value, label: t(`movementType.${value}`) }))}
            {...register('type')}
          />
        </FormField>
        <FormField
          label={t('fields.quantity')}
          error={errors.quantity?.message}
          hint={type === 'adjustment' ? t('movement.adjustmentHint') : undefined}
          required
        >
          <Input inputMode="decimal" autoComplete="off" data-autofocus {...register('quantity')} />
        </FormField>
        <FormField label={t('fields.unit')} error={errors.unitId?.message} hint={t('movement.unitHint')}>
          <Select
            placeholder={selected ? t('movement.baseUnit', { unit: selected.baseUnitCode }) : t('movement.baseUnitShort')}
            options={unitOptions(units.data)}
            {...register('unitId')}
          />
        </FormField>
        {type === 'receipt' && (
          <FormField label={t('fields.unitCost', { currency: format.currency })} error={errors.unitCost?.message}>
            <Input inputMode="decimal" autoComplete="off" {...register('unitCost')} />
          </FormField>
        )}
        <FormField label={t('fields.reason')} error={errors.reason?.message} required>
          <Textarea maxLength={500} placeholder={t('movement.reasonPlaceholder')} {...register('reason')} />
        </FormField>
      </FormGrid>
    </Modal>
  );
}
