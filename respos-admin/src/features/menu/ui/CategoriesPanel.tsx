import { Archive, ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useArchiveMenuCategory, useMenuCategories, useReorderMenuCategories } from '@/entities/menu/menu.queries';
import type { MenuCategoryDto } from '@/entities/menu/menu.types';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Button, ConfirmDialog, EmptyState, ErrorState, IconButton, Skeleton, StatusBadge, useToast } from '@/shared/ui';
import { CategoryFormModal } from './CategoryFormModal';
import styles from './MenuPanels.module.css';

/** Categories with keyboard/touch-friendly reorder (up/down → `PUT /menu/categories/reorder`). */
export function CategoriesPanel({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation('menu');
  const toast = useToast();
  const categories = useMenuCategories();
  const reorder = useReorderMenuCategories();
  const archive = useArchiveMenuCategory();
  const [editing, setEditing] = useState<MenuCategoryDto | null | 'new'>(null);
  const [archiving, setArchiving] = useState<MenuCategoryDto | null>(null);
  const list = (categories.data ?? []).filter((category) => !category.isArchived);

  const move = (index: number, delta: number) => {
    const ids = list.map((category) => category.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target] as string, ids[index] as string];
    reorder.mutate(ids, { onError: (error) => toast.error(t('toast.reorderFailed'), getErrorMessage(error, t)) });
  };

  const doArchive = async () => {
    if (!archiving) return;
    try {
      await archive.mutateAsync(archiving.id);
      toast.success(t('toast.categoryArchived'));
    } catch (error) {
      toast.error(t('toast.actionFailed'), getErrorMessage(error, t));
    } finally {
      setArchiving(null);
    }
  };

  const renderList = () => {
    if (categories.error && !categories.data)
      return <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />;
    if (categories.isLoading) return <Skeleton height={168} radius="var(--radius-md)" />;
    if (list.length === 0) return <EmptyState title={t('categories.empty')} description={t('categories.emptyHint')} />;
    return (
      <ol className={styles.categoryList} aria-label={t('tabs.categories')}>
        {list.map((category, index) => (
          <li key={category.id} className={styles.categoryRow}>
            <span className={styles.categoryIndex}>{index + 1}</span>
            <span className={styles.categoryName}>
              <strong>{category.name}</strong>
              {category.nameUz && <small className={styles.muted}>{category.nameUz}</small>}
            </span>
            {!category.isActive && (
              <StatusBadge tone="neutral" size="sm">
                {t('categories.hidden')}
              </StatusBadge>
            )}
            {canManage && (
              <span className={styles.rowActions}>
                <IconButton
                  label={t('categories.moveUp', { name: category.name })}
                  icon={<ArrowUp />}
                  disabled={index === 0 || reorder.isPending}
                  onClick={() => move(index, -1)}
                />
                <IconButton
                  label={t('categories.moveDown', { name: category.name })}
                  icon={<ArrowDown />}
                  disabled={index === list.length - 1 || reorder.isPending}
                  onClick={() => move(index, 1)}
                />
                <IconButton
                  label={t('actions.editNamed', { name: category.name })}
                  icon={<Pencil />}
                  onClick={() => setEditing(category)}
                />
                <IconButton
                  label={t('actions.archiveNamed', { name: category.name })}
                  icon={<Archive />}
                  onClick={() => setArchiving(category)}
                />
              </span>
            )}
          </li>
        ))}
      </ol>
    );
  };

  return (
    <>
      {canManage && (
        <div className={styles.panelBar}>
          <Button icon={<Plus />} onClick={() => setEditing('new')}>
            {t('categories.create')}
          </Button>
        </div>
      )}
      {renderList()}
      {editing && <CategoryFormModal category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={archiving !== null}
        title={t('categories.archiveTitle')}
        message={t('categories.archiveMessage', { name: archiving?.name ?? '' })}
        confirmLabel={t('actions.archive')}
        loading={archive.isPending}
        onConfirm={() => void doArchive()}
        onCancel={() => setArchiving(null)}
      />
    </>
  );
}
