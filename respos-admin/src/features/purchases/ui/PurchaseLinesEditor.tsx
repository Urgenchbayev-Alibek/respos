import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue, type UseFormGetValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { IngredientDto } from '@/entities/ingredient/ingredient.types';
import type { UnitDto } from '@/entities/unit/unit.types';
import { unitOptions } from '@/entities/unit/unit.queries';
import styles from '@/features/stock/ui/stock.module.css';
import { Button, FormField, IconButton, Input, Select } from '@/shared/ui';
import { EMPTY_PURCHASE_LINE, type PurchaseFormValues } from '../model/purchase-schema';

export interface PurchaseLinesEditorProps {
  control: Control<PurchaseFormValues>;
  register: UseFormRegister<PurchaseFormValues>;
  setValue: UseFormSetValue<PurchaseFormValues>;
  getValues: UseFormGetValues<PurchaseFormValues>;
  errors: FieldErrors<PurchaseFormValues>;
  ingredients: IngredientDto[];
  units: UnitDto[] | undefined;
}

/** Draft purchase lines: ingredient, quantity, unit (defaults to base unit), unit price. */
export function PurchaseLinesEditor({ control, register, setValue, getValues, errors, ingredients, units }: PurchaseLinesEditorProps) {
  const { t } = useTranslation('purchases');
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const ingredientOptions = ingredients.filter((item) => !item.isArchived).map((item) => ({ value: item.id, label: item.name }));
  const label = (text: string) => <span className="visually-hidden">{text}</span>;

  return (
    <div className={styles.stack}>
      <div className={styles.linesScroll}>
        <table className={styles.linesTable}>
          <thead>
            <tr>
              <th scope="col">{t('columns.ingredient')}</th>
              <th scope="col">{t('columns.quantity')}</th>
              <th scope="col">{t('columns.unit')}</th>
              <th scope="col">{t('columns.unitPrice')}</th>
              <th scope="col">{label(t('columns.actions'))}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const lineErrors = errors.items?.[index];
              const ingredientField = register(`items.${index}.ingredientId`);
              return (
                <tr key={field.id}>
                  <td>
                    <FormField label={label(t('columns.ingredient'))} error={lineErrors?.ingredientId?.message}>
                      <Select
                        placeholder={t('selectIngredient')}
                        options={ingredientOptions}
                        {...ingredientField}
                        onChange={(event) => {
                          void ingredientField.onChange(event);
                          const ingredient = ingredients.find((item) => item.id === event.target.value);
                          if (ingredient && !getValues(`items.${index}.unitId`)) setValue(`items.${index}.unitId`, ingredient.baseUnitId);
                        }}
                      />
                    </FormField>
                  </td>
                  <td>
                    <FormField label={label(t('columns.quantity'))} error={lineErrors?.quantity?.message}>
                      <Input className={styles.lineInput} inputMode="decimal" {...register(`items.${index}.quantity`)} />
                    </FormField>
                  </td>
                  <td>
                    <FormField label={label(t('columns.unit'))} error={lineErrors?.unitId?.message}>
                      <Select placeholder="—" options={unitOptions(units)} {...register(`items.${index}.unitId`)} />
                    </FormField>
                  </td>
                  <td>
                    <FormField label={label(t('columns.unitPrice'))} error={lineErrors?.unitPrice?.message}>
                      <Input className={styles.lineInput} inputMode="decimal" {...register(`items.${index}.unitPrice`)} />
                    </FormField>
                  </td>
                  <td>
                    <IconButton label={t('removeLine')} icon={<Trash2 />} disabled={fields.length === 1} onClick={() => remove(index)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <Button icon={<Plus />} onClick={() => append(EMPTY_PURCHASE_LINE)}>
          {t('addLine')}
        </Button>
      </div>
    </div>
  );
}
