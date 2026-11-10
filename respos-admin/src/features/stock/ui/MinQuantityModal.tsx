import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSetMinQuantity } from '@/entities/ingredient/ingredient.queries';
import type { IngredientDto } from '@/entities/ingredient/ingredient.types';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Input, Modal, useToast } from '@/shared/ui';
import { minQuantitySchema, type MinQuantityOutput } from '../model/stock-schemas';
import { formatUnit } from '@/shared/lib/format-unit';

interface Values {
  minQuantity: string;
}

/** Minimum quantity is per branch (StockBalance.MinQuantity, contract v1.1 §5). */
export function MinQuantityModal({ ingredient, onClose }: { ingredient: IngredientDto | null; onClose: () => void }) {
  const { t } = useTranslation('stock');
  const toast = useToast();
  const save = useSetMinQuantity();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<Values, unknown, MinQuantityOutput>({
    resolver: zodResolver(minQuantitySchema) as unknown as Resolver<Values>,
    defaultValues: { minQuantity: '' },
  });

  useEffect(() => {
    if (ingredient) reset({ minQuantity: String(ingredient.minQuantity ?? '') });
    setServerError(null);
  }, [ingredient, reset]);

  const onSubmit = handleSubmit(async ({ minQuantity }) => {
    if (!ingredient) return;
    try {
      await save.mutateAsync({ id: ingredient.id, minQuantity });
      toast.success(t('ingredients.minSaved'));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['minQuantity'])) setServerError(getErrorMessage(error, t));
    }
  });

  return (
    <Modal
      open={Boolean(ingredient)}
      onClose={onClose}
      size="sm"
      title={t('ingredients.minTitle')}
      description={ingredient?.name}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" type="submit" form="min-quantity-form" loading={formState.isSubmitting}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <FormGrid id="min-quantity-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField
          label={t('fields.minQuantityUnit', { unit: formatUnit(ingredient?.baseUnitCode) })}
          error={formState.errors.minQuantity?.message}
          hint={t('ingredients.minHint')}
          required
        >
          <Input inputMode="decimal" autoComplete="off" data-autofocus {...register('minQuantity')} />
        </FormField>
      </FormGrid>
    </Modal>
  );
}
