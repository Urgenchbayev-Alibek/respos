import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSaveModifierGroup } from '@/entities/menu/menu.queries';
import type { ModifierGroupDto } from '@/entities/menu/menu.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, IconButton, Input, Modal, MoneyInput, Switch, useToast } from '@/shared/ui';
import {
  modifierGroupSchema,
  toModifierGroupFormValues,
  toModifierGroupInput,
  type ModifierGroupFormOutput,
  type ModifierGroupFormValues,
} from '../model/menu-schemas';
import styles from './MenuForms.module.css';

export function ModifierGroupFormModal({ group, onClose }: { group: ModifierGroupDto | null; onClose: () => void }) {
  const { t } = useTranslation('menu');
  const toast = useToast();
  const { currency } = useFormatters();
  const save = useSaveModifierGroup();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, control, handleSubmit, setError, formState } = useForm<
    ModifierGroupFormValues,
    unknown,
    ModifierGroupFormOutput
  >({
    resolver: zodResolver(modifierGroupSchema),
    defaultValues: toModifierGroupFormValues(group),
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'options' });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await save.mutateAsync({ id: group?.id, input: toModifierGroupInput(values) });
      toast.success(t('toast.groupSaved'));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['name', 'minSelect', 'maxSelect'])) setServerError(getErrorMessage(error, t));
    }
  });

  const errors = formState.errors;
  const optionsError = errors.options?.message ?? errors.options?.root?.message;
  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={t(group ? 'modifiers.editTitle' : 'modifiers.createTitle')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button type="submit" form="modifier-group-form" variant="primary" loading={formState.isSubmitting}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <FormGrid id="modifier-group-form" columns={2} onSubmit={onSubmit}>
        {serverError && (
          <div data-span="full">
            <Alert>{serverError}</Alert>
          </div>
        )}
        <div data-span="full">
          <FormField label={t('modifiers.name')} error={errors.name?.message} required>
            <Input data-autofocus {...register('name')} />
          </FormField>
        </div>
        <FormField label={t('modifiers.minSelect')} error={errors.minSelect?.message}>
          <Input type="number" inputMode="numeric" min={0} {...register('minSelect')} />
        </FormField>
        <FormField label={t('modifiers.maxSelect')} error={errors.maxSelect?.message}>
          <Input type="number" inputMode="numeric" min={1} {...register('maxSelect')} />
        </FormField>
        <div data-span="full">
          <Controller
            control={control}
            name="isRequired"
            render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label={t('modifiers.isRequired')} />}
          />
        </div>
        <fieldset className={styles.fieldset} data-span="full">
          <legend className={styles.legend}>{t('modifiers.options')}</legend>
          {fields.map((field, index) => (
            <div key={field.id} className={styles.optionRow}>
              <FormField label={t('modifiers.optionName')} error={errors.options?.[index]?.name?.message} required>
                <Input {...register(`options.${index}.name`)} />
              </FormField>
              <FormField label={t('modifiers.priceDelta')} error={errors.options?.[index]?.priceDelta?.message}>
                <Controller
                  control={control}
                  name={`options.${index}.priceDelta`}
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
              <IconButton
                label={t('modifiers.removeOption', { index: index + 1 })}
                icon={<Trash2 />}
                disabled={fields.length === 1}
                onClick={() => remove(index)}
              />
            </div>
          ))}
          {optionsError && (
            <p className={styles.error} role="alert">
              {t(optionsError)}
            </p>
          )}
          <div>
            <Button size="sm" icon={<Plus />} onClick={() => append({ name: '', priceDelta: 0 })}>
              {t('modifiers.addOption')}
            </Button>
          </div>
        </fieldset>
      </FormGrid>
    </Modal>
  );
}
