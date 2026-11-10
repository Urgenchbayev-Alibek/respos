import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useIngredientOptions } from '@/entities/ingredient/ingredient.queries';
import { useSaveStockTransfer } from '@/entities/stock-transfer/stock-transfer.queries';
import type { StockTransferDto } from '@/entities/stock-transfer/stock-transfer.types';
import { unitOptions, useUnits } from '@/entities/unit/unit.queries';
import styles from '@/features/stock/ui/stock.module.css';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, IconButton, Input, Modal, Select, Textarea, useToast } from '@/shared/ui';
import {
  EMPTY_TRANSFER_LINE,
  toTransferFormValues,
  toTransferInput,
  transferSchema,
  type TransferFormOutput,
  type TransferFormValues,
} from '../model/transfer-schema';

export interface TransferFormModalProps {
  open: boolean;
  /** Edit an existing draft; omit to create. */
  transfer?: StockTransferDto | null;
  onClose: () => void;
  onSaved?: (transfer: StockTransferDto) => void;
}

/** Create / edit a DRAFT transfer from the current branch to another branch the user can see. */
export function TransferFormModal({ open, transfer, onClose, onSaved }: TransferFormModalProps) {
  const { t } = useTranslation('transfers');
  const toast = useToast();
  const { branch, branches } = useCurrentBranch();
  const ingredients = useIngredientOptions(open);
  const units = useUnits();
  const save = useSaveStockTransfer();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<TransferFormValues, unknown, TransferFormOutput>({
    resolver: zodResolver(transferSchema) as unknown as Resolver<TransferFormValues>,
    defaultValues: toTransferFormValues(transfer),
  });
  const { register, handleSubmit, reset, setError, setValue, getValues, control, formState } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  useEffect(() => {
    if (open) {
      reset(toTransferFormValues(transfer));
      setServerError(null);
    }
  }, [open, transfer, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const saved = await save.mutateAsync({
        id: transfer?.id,
        input: toTransferInput(values),
      });
      toast.success(t(transfer ? 'toast.updated' : 'toast.created'));
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['toBranchId', 'comment'])) setServerError(getErrorMessage(error, t));
    }
  });

  const errors = formState.errors;
  const items = ingredients.data?.items ?? [];
  const ingredientOptions = items.filter((item) => !item.isArchived).map((item) => ({ value: item.id, label: item.name }));
  const destinations = branches.filter((b) => b.id !== branch?.id).map((b) => ({ value: b.id, label: b.name }));
  const hidden = (text: string) => <span className="visually-hidden">{text}</span>;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={transfer ? t('form.editTitle', { number: transfer.number }) : t('form.createTitle')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose} disabled={formState.isSubmitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="primary" type="submit" form="transfer-form" loading={formState.isSubmitting}>
            {t('form.saveDraft')}
          </Button>
        </>
      }
    >
      <FormGrid id="transfer-form" columns={2} onSubmit={onSubmit}>
        {serverError && (
          <div data-span="full">
            <Alert>{serverError}</Alert>
          </div>
        )}
        {destinations.length === 0 && (
          <div data-span="full">
            <Alert>{t('form.noDestinations')}</Alert>
          </div>
        )}
        <FormField label={t('fields.from')}>
          <Input value={branch?.name ?? ''} readOnly />
        </FormField>
        <FormField label={t('fields.to')} error={errors.toBranchId?.message} required>
          <Select placeholder={t('fields.selectBranch')} options={destinations} data-autofocus {...register('toBranchId')} />
        </FormField>
        <div data-span="full">
          <FormField label={t('fields.comment')} error={errors.comment?.message}>
            <Textarea rows={2} {...register('comment')} />
          </FormField>
        </div>
        <div data-span="full" className={styles.stack}>
          <div className={styles.linesScroll}>
            <table className={styles.linesTable}>
              <thead>
                <tr>
                  <th scope="col">{t('columns.ingredient')}</th>
                  <th scope="col">{t('columns.quantity')}</th>
                  <th scope="col">{t('columns.unit')}</th>
                  <th scope="col">{hidden(t('columns.actions'))}</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => {
                  const lineErrors = errors.lines?.[index];
                  const ingredientField = register(`lines.${index}.ingredientId`);
                  return (
                    <tr key={field.id}>
                      <td>
                        <FormField label={hidden(t('columns.ingredient'))} error={lineErrors?.ingredientId?.message}>
                          <Select
                            placeholder={t('fields.selectIngredient')}
                            options={ingredientOptions}
                            {...ingredientField}
                            onChange={(event) => {
                              void ingredientField.onChange(event);
                              const ingredient = items.find((item) => item.id === event.target.value);
                              if (ingredient && !getValues(`lines.${index}.unitId`))
                                setValue(`lines.${index}.unitId`, ingredient.baseUnitId);
                            }}
                          />
                        </FormField>
                      </td>
                      <td>
                        <FormField label={hidden(t('columns.quantity'))} error={lineErrors?.quantity?.message}>
                          <Input className={styles.lineInput} inputMode="decimal" {...register(`lines.${index}.quantity`)} />
                        </FormField>
                      </td>
                      <td>
                        <FormField label={hidden(t('columns.unit'))} error={lineErrors?.unitId?.message}>
                          <Select placeholder="—" options={unitOptions(units.data)} {...register(`lines.${index}.unitId`)} />
                        </FormField>
                      </td>
                      <td>
                        <IconButton
                          label={t('form.removeLine')}
                          icon={<Trash2 />}
                          disabled={fields.length === 1}
                          onClick={() => remove(index)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div>
            <Button icon={<Plus />} onClick={() => append({ ...EMPTY_TRANSFER_LINE })}>
              {t('form.addLine')}
            </Button>
          </div>
          {errors.lines?.message && <Alert>{t(errors.lines.message)}</Alert>}
        </div>
      </FormGrid>
    </Modal>
  );
}
