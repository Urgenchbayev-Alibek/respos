import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useKitchenStations } from '@/entities/kitchen-station/kitchen-station.queries';
import { useSaveMenuItem, useUploadMenuItemPhoto } from '@/entities/menu/menu-item.queries';
import { useModifierGroups } from '@/entities/menu/menu.queries';
import type { MenuCategoryDto, MenuItemDto } from '@/entities/menu/menu.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Input, Modal, MoneyInput, Select, Switch, Textarea, useToast } from '@/shared/ui';
import {
  menuItemSchema,
  toMenuItemFormValues,
  toMenuItemInput,
  type MenuItemFormOutput,
  type MenuItemFormValues,
} from '../model/menu-schemas';
import styles from './MenuForms.module.css';
import { ModifierGroupsPicker } from './ModifierGroupsPicker';
import { PhotoUpload } from './PhotoUpload';
import { VariantsEditor } from './VariantsEditor';

export interface MenuItemFormModalProps {
  item: MenuItemDto | null;
  categories: MenuCategoryDto[];
  defaultCategoryId?: string;
  onClose: () => void;
}

const FIELDS = ['name', 'nameUz', 'description', 'sku', 'categoryId', 'price', 'prepTimeMinutes', 'kitchenStationId'] as const;

/** Create / edit a dish: names RU/UZ, price, variants (absolute price), modifier groups, station, prep time, photo. */
export function MenuItemFormModal({ item, categories, defaultCategoryId, onClose }: MenuItemFormModalProps) {
  const { t } = useTranslation('menu');
  const toast = useToast();
  const { currency } = useFormatters();
  const save = useSaveMenuItem();
  const upload = useUploadMenuItemPhoto();
  const stations = useKitchenStations();
  const groups = useModifierGroups();
  const [photo, setPhoto] = useState<File | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, control, handleSubmit, setError, setValue, formState } = useForm<
    MenuItemFormValues,
    unknown,
    MenuItemFormOutput
  >({
    resolver: zodResolver(menuItemSchema),
    defaultValues: toMenuItemFormValues(item, defaultCategoryId ?? categories[0]?.id ?? ''),
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    let saved: MenuItemDto;
    try {
      saved = await save.mutateAsync({ id: item?.id, input: toMenuItemInput(values) });
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, FIELDS)) setServerError(getErrorMessage(error, t));
      return;
    }
    const savedId = saved?.id ?? item?.id;
    if (photo && savedId) {
      try {
        await upload.mutateAsync({ id: savedId, file: photo });
      } catch (error) {
        toast.error(t('photo.uploadFailed'), getErrorMessage(error, t));
      }
    }
    toast.success(t(item ? 'toast.itemUpdated' : 'toast.itemCreated'));
    onClose();
  });

  const errors = formState.errors;
  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={t(item ? 'itemForm.editTitle' : 'itemForm.createTitle')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button type="submit" form="menu-item-form" variant="primary" loading={formState.isSubmitting}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <FormGrid id="menu-item-form" columns={2} onSubmit={onSubmit}>
        {serverError && (
          <div data-span="full">
            <Alert>{serverError}</Alert>
          </div>
        )}
        <FormField label={t('itemForm.name')} error={errors.name?.message} required>
          <Input data-autofocus {...register('name')} />
        </FormField>
        <FormField label={t('itemForm.nameUz')} error={errors.nameUz?.message}>
          <Input lang="uz" {...register('nameUz')} />
        </FormField>
        <FormField label={t('itemForm.category')} error={errors.categoryId?.message} required>
          <Select
            placeholder={t('itemForm.categoryPlaceholder')}
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
            {...register('categoryId')}
          />
        </FormField>
        <FormField label={t('itemForm.price')} error={errors.price?.message} required>
          <Controller
            control={control}
            name="price"
            render={({ field }) => (
              <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} currency={currency} />
            )}
          />
        </FormField>
        <FormField label={t('itemForm.station')} error={errors.kitchenStationId?.message} hint={t('itemForm.stationHint')}>
          <Select
            placeholder={t('itemForm.defaultStation')}
            options={(stations.data ?? []).map((station) => ({ value: station.id, label: station.name }))}
            {...register('kitchenStationId')}
          />
        </FormField>
        <FormField label={t('itemForm.prepTime')} error={errors.prepTimeMinutes?.message}>
          <Input inputMode="numeric" {...register('prepTimeMinutes')} />
        </FormField>
        <FormField label={t('itemForm.sku')} error={errors.sku?.message}>
          <Input {...register('sku')} />
        </FormField>
        <div className={styles.switchRow}>
          <Controller
            control={control}
            name="isAvailable"
            render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label={t('itemForm.isAvailable')} />}
          />
        </div>
        <div data-span="full">
          <FormField label={t('itemForm.description')} error={errors.description?.message}>
            <Textarea rows={2} maxLength={1000} {...register('description')} />
          </FormField>
        </div>
        <div data-span="full">
          <PhotoUpload photoUrl={item?.photoUrl} file={photo} onFileChange={setPhoto} />
        </div>
        <div data-span="full">
          <VariantsEditor control={control} register={register} errors={errors} setValue={setValue} />
        </div>
        <div data-span="full">
          <Controller
            control={control}
            name="modifierGroupIds"
            render={({ field }) => (
              <ModifierGroupsPicker groups={groups.data ?? []} value={field.value} onChange={field.onChange} />
            )}
          />
        </div>
      </FormGrid>
    </Modal>
  );
}
