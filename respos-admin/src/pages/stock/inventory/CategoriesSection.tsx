import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  useDeleteIngredientCategory,
  useIngredientCategories,
  useSaveIngredientCategory,
} from '@/entities/ingredient/ingredient.queries';
import type { IngredientCategoryDto } from '@/entities/ingredient/ingredient.types';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { requiredString } from '@/shared/lib/validation';
import {
  Alert,
  Button,
  ConfirmDialog,
  DataTable,
  FormField,
  FormGrid,
  IconButton,
  Input,
  Modal,
  Toolbar,
  useToast,
  type DataTableColumn,
} from '@/shared/ui';

const schema = z.object({ name: requiredString(100) });

function CategoryModal({ target, onClose }: { target: { category: IngredientCategoryDto | null } | null; onClose: () => void }) {
  const { t } = useTranslation('stock');
  const toast = useToast();
  const save = useSaveIngredientCategory();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<{ name: string }>({ resolver: zodResolver(schema) });
  useEffect(() => {
    reset({ name: target?.category?.name ?? '' });
    setServerError(null);
  }, [target, reset]);

  const onSubmit = handleSubmit(async ({ name }) => {
    try {
      await save.mutateAsync({ id: target?.category?.id, name });
      toast.success(t('categories.saved'));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['name'])) setServerError(getErrorMessage(error, t));
    }
  });

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      size="sm"
      title={t(target?.category ? 'categories.editTitle' : 'categories.createTitle')}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" type="submit" form="category-form" loading={formState.isSubmitting}>{t('common:actions.save')}</Button>
        </>
      }
    >
      <FormGrid id="category-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('fields.name')} error={formState.errors.name?.message} required>
          <Input autoComplete="off" data-autofocus {...register('name')} />
        </FormField>
      </FormGrid>
    </Modal>
  );
}

/** Ingredient categories (simple reference list). */
export function CategoriesSection() {
  const { t } = useTranslation('stock');
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const categories = useIngredientCategories();
  const remove = useDeleteIngredientCategory();
  const [editing, setEditing] = useState<{ category: IngredientCategoryDto | null } | null>(null);
  const [deleting, setDeleting] = useState<IngredientCategoryDto | null>(null);
  const canManage = hasPermission(PERMISSIONS.inventory.manage);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success(t('categories.deleted'));
    } catch (error) {
      toast.error(t('categories.deleteFailed'), getErrorMessage(error, t));
    } finally {
      setDeleting(null);
    }
  };

  const columns: DataTableColumn<IngredientCategoryDto>[] = [
    { key: 'name', header: t('fields.name'), cell: (row) => row.name },
    {
      key: 'actions',
      header: <span className="visually-hidden">{t('columns.actions')}</span>,
      align: 'right',
      width: '112px',
      cell: (row) =>
        canManage && (
          <>
            <IconButton label={t('actions.editNamed', { name: row.name })} icon={<Pencil />} onClick={() => setEditing({ category: row })} />
            <IconButton label={t('actions.deleteNamed', { name: row.name })} icon={<Trash2 />} onClick={() => setDeleting(row)} />
          </>
        ),
    },
  ];

  return (
    <>
      <Toolbar
        actions={canManage && <Button variant="primary" icon={<Plus />} onClick={() => setEditing({ category: null })}>{t('categories.add')}</Button>}
      >
        <p>{t('categories.description')}</p>
      </Toolbar>
      <DataTable
        caption={t('tabs.categories')}
        columns={columns}
        rows={categories.data}
        getRowId={(row) => row.id}
        isLoading={categories.isFetching}
        error={categories.error}
        onRetry={() => void categories.refetch()}
        emptyTitle={t('categories.empty')}
      />
      <CategoryModal target={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title={t('categories.deleteTitle')}
        message={t('categories.deleteMessage', { name: deleting?.name ?? '' })}
        confirmLabel={t('common:actions.delete')}
        loading={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
