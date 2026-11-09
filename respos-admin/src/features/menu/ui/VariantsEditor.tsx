import { Plus, Trash2 } from 'lucide-react';
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Button, FormField, IconButton, Input, MoneyInput } from '@/shared/ui';
import type { MenuItemFormValues } from '../model/menu-schemas';
import styles from './MenuForms.module.css';

export interface VariantsEditorProps {
  control: Control<MenuItemFormValues>;
  register: UseFormRegister<MenuItemFormValues>;
  errors: FieldErrors<MenuItemFormValues>;
  setValue: UseFormSetValue<MenuItemFormValues>;
}

/** Variants (portion sizes) with ABSOLUTE prices; exactly one default when any exist. */
export function VariantsEditor({ control, register, errors, setValue }: VariantsEditorProps) {
  const { t } = useTranslation('menu');
  const { currency } = useFormatters();
  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });
  const variants = useWatch({ control, name: 'variants' });
  const rootError = errors.variants?.message ?? errors.variants?.root?.message;

  const makeDefault = (index: number) =>
    fields.forEach((_field, i) => setValue(`variants.${i}.isDefault`, i === index, { shouldDirty: true }));

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{t('variants.title')}</legend>
      <p className={styles.hint}>{t('variants.hint')}</p>
      {fields.map((field, index) => (
        <div key={field.id} className={styles.variantRow}>
          <FormField label={t('variants.name')} error={errors.variants?.[index]?.name?.message} required>
            <Input {...register(`variants.${index}.name`)} />
          </FormField>
          <FormField label={t('variants.price')} error={errors.variants?.[index]?.price?.message} required>
            <Controller
              control={control}
              name={`variants.${index}.price`}
              render={({ field: priceField }) => (
                <MoneyInput
                  value={priceField.value}
                  onChange={priceField.onChange}
                  onBlur={priceField.onBlur}
                  currency={currency}
                />
              )}
            />
          </FormField>
          <label className={styles.radio}>
            <input
              type="radio"
              name="default-variant"
              checked={Boolean(variants?.[index]?.isDefault)}
              onChange={() => makeDefault(index)}
            />
            {t('variants.default')}
          </label>
          <IconButton label={t('variants.remove', { index: index + 1 })} icon={<Trash2 />} onClick={() => remove(index)} />
        </div>
      ))}
      {rootError && (
        <p className={styles.error} role="alert">
          {t(rootError)}
        </p>
      )}
      <div>
        <Button
          icon={<Plus />}
          size="sm"
          onClick={() => append({ name: '', price: null as unknown as number, isDefault: fields.length === 0 })}
        >
          {t('variants.add')}
        </Button>
      </div>
    </fieldset>
  );
}
