import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useIngredientOptions } from '@/entities/ingredient/ingredient.queries';
import { useSavePurchase } from '@/entities/purchase/purchase.queries';
import type { PurchaseDto } from '@/entities/purchase/purchase.types';
import { useSupplierOptions } from '@/entities/supplier/supplier.queries';
import { useUnits } from '@/entities/unit/unit.queries';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Input, Modal, Select, Textarea, useToast } from '@/shared/ui';
import {
  purchaseSchema,
  toPurchaseFormValues,
  toPurchaseInput,
  type PurchaseFormOutput,
  type PurchaseFormValues,
} from '../model/purchase-schema';
import { PurchaseLinesEditor } from './PurchaseLinesEditor';

export interface PurchaseFormModalProps {
  open: boolean;
  /** Edit an existing draft; omit to create. */
  purchase?: PurchaseDto | null;
  onClose: () => void;
  onSaved?: (purchase: PurchaseDto) => void;
}

/** Create / edit a DRAFT purchase (only drafts are editable — server enforces). */
export function PurchaseFormModal({ open, purchase, onClose, onSaved }: PurchaseFormModalProps) {
  const { t } = useTranslation('purchases');
  const toast = useToast();
  const suppliers = useSupplierOptions(open);
  const ingredients = useIngredientOptions(open);
  const units = useUnits();
  const save = useSavePurchase();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<PurchaseFormValues, unknown, PurchaseFormOutput>({
    resolver: zodResolver(purchaseSchema) as unknown as Resolver<PurchaseFormValues>,
    defaultValues: toPurchaseFormValues(purchase),
  });
  const { register, handleSubmit, reset, setError, setValue, getValues, control, formState } = form;

  useEffect(() => {
    if (open) {
      reset(toPurchaseFormValues(purchase));
      setServerError(null);
    }
  }, [open, purchase, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const saved = await save.mutateAsync({ id: purchase?.id, input: toPurchaseInput(values) });
      toast.success(t(purchase ? 'toast.updated' : 'toast.created'));
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['supplierId', 'expectedAt', 'comment'])) setServerError(getErrorMessage(error, t));
    }
  });

  const errors = formState.errors;
  const supplierOptions = (suppliers.data?.items ?? [])
    .filter((supplier) => !supplier.isArchived || supplier.id === purchase?.supplierId)
    .map((supplier) => ({ value: supplier.id, label: supplier.name }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={purchase ? t('form.editTitle', { number: purchase.number }) : t('form.createTitle')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose} disabled={formState.isSubmitting}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" type="submit" form="purchase-form" loading={formState.isSubmitting}>{t('form.saveDraft')}</Button>
        </>
      }
    >
      <FormGrid id="purchase-form" columns={2} onSubmit={onSubmit}>
        {serverError && <div data-span="full"><Alert>{serverError}</Alert></div>}
        <FormField label={t('fields.supplier')} error={errors.supplierId?.message} required>
          <Select placeholder={t('selectSupplier')} options={supplierOptions} data-autofocus {...register('supplierId')} />
        </FormField>
        <FormField label={t('fields.expectedAt')} error={errors.expectedAt?.message}>
          <Input type="date" {...register('expectedAt')} />
        </FormField>
        <div data-span="full">
          <FormField label={t('fields.comment')} error={errors.comment?.message}>
            <Textarea rows={2} {...register('comment')} />
          </FormField>
        </div>
        <div data-span="full">
          <PurchaseLinesEditor
            control={control}
            register={register}
            setValue={setValue}
            getValues={getValues}
            errors={errors}
            ingredients={ingredients.data?.items ?? []}
            units={units.data}
          />
          {errors.items?.message && <Alert>{t(errors.items.message)}</Alert>}
        </div>
      </FormGrid>
    </Modal>
  );
}
