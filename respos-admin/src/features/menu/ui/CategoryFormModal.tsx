import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useSaveMenuCategory } from '@/entities/menu/menu.queries';
import type { MenuCategoryDto } from '@/entities/menu/menu.types';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { optionalString, requiredString } from '@/shared/lib/validation';
import { Alert, Button, FormField, FormGrid, Input, Modal, Switch, useToast } from '@/shared/ui';

const categorySchema = z.object({ name: requiredString(100), nameUz: optionalString(100), isActive: z.boolean() });
type CategoryValues = z.input<typeof categorySchema>;
type CategoryOutput = z.output<typeof categorySchema>;

export function CategoryFormModal({ category, onClose }: { category: MenuCategoryDto | null; onClose: () => void }) {
  const { t } = useTranslation('menu');
  const toast = useToast();
  const save = useSaveMenuCategory();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, control, handleSubmit, setError, formState } = useForm<CategoryValues, unknown, CategoryOutput>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: category?.name ?? '', nameUz: category?.nameUz ?? '', isActive: category?.isActive ?? true },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await save.mutateAsync({ id: category?.id, input: values });
      toast.success(t('toast.categorySaved'));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['name', 'nameUz'])) setServerError(getErrorMessage(error, t));
    }
  });

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={t(category ? 'categories.editTitle' : 'categories.createTitle')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button type="submit" form="category-form" variant="primary" loading={formState.isSubmitting}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <FormGrid id="category-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('categories.name')} error={formState.errors.name?.message} required>
          <Input data-autofocus {...register('name')} />
        </FormField>
        <FormField label={t('categories.nameUz')} error={formState.errors.nameUz?.message}>
          <Input lang="uz" {...register('nameUz')} />
        </FormField>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label={t('categories.isActive')} />}
        />
      </FormGrid>
    </Modal>
  );
}
