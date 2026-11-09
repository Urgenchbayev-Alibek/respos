import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeleteModifierGroup, useModifierGroups } from '@/entities/menu/menu.queries';
import type { ModifierGroupDto } from '@/entities/menu/menu.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Button, ConfirmDialog, DataTable, IconButton, StatusBadge, useToast, type DataTableColumn } from '@/shared/ui';
import { ModifierGroupFormModal } from './ModifierGroupFormModal';
import styles from './MenuPanels.module.css';

export function ModifierGroupsPanel({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation('menu');
  const toast = useToast();
  const format = useFormatters();
  const groups = useModifierGroups();
  const remove = useDeleteModifierGroup();
  const [editing, setEditing] = useState<ModifierGroupDto | null | 'new'>(null);
  const [deleting, setDeleting] = useState<ModifierGroupDto | null>(null);

  const columns = useMemo<DataTableColumn<ModifierGroupDto>[]>(() => {
    const base: DataTableColumn<ModifierGroupDto>[] = [
      { key: 'name', header: t('modifiers.name'), cell: (group) => <strong>{group.name}</strong> },
      {
        key: 'rule',
        header: t('modifiers.rule'),
        cell: (group) => (
          <>
            {t('modifiers.range', { min: group.minSelect, max: group.maxSelect })}{' '}
            {group.isRequired && (
              <StatusBadge tone="warning" size="sm">
                {t('modifiers.required')}
              </StatusBadge>
            )}
          </>
        ),
      },
      {
        key: 'options',
        header: t('modifiers.options'),
        hideOnMobile: true,
        cell: (group) =>
          group.options
            .map((option) => (option.priceDelta ? `${option.name} (+${format.money(option.priceDelta)})` : option.name))
            .join(', '),
      },
    ];
    if (!canManage) return base;
    return [
      ...base,
      {
        key: 'actions',
        header: <span className="visually-hidden">{t('columns.actions')}</span>,
        align: 'right',
        width: '112px',
        cell: (group) => (
          <>
            <IconButton
              label={t('actions.editNamed', { name: group.name })}
              icon={<Pencil />}
              onClick={() => setEditing(group)}
            />
            <IconButton
              label={t('actions.deleteNamed', { name: group.name })}
              icon={<Trash2 />}
              onClick={() => setDeleting(group)}
            />
          </>
        ),
      },
    ];
  }, [t, format, canManage]);

  const doDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success(t('toast.groupDeleted'));
    } catch (error) {
      toast.error(t('toast.actionFailed'), getErrorMessage(error, t));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      {canManage && (
        <div className={styles.panelBar}>
          <Button icon={<Plus />} onClick={() => setEditing('new')}>
            {t('modifiers.create')}
          </Button>
        </div>
      )}
      <DataTable
        caption={t('tabs.modifiers')}
        columns={columns}
        rows={groups.data}
        getRowId={(group) => group.id}
        isLoading={groups.isFetching}
        error={groups.error}
        onRetry={() => void groups.refetch()}
        emptyTitle={t('modifiers.empty')}
        emptyDescription={t('modifiers.emptyHint')}
      />
      {editing && <ModifierGroupFormModal group={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        title={t('modifiers.deleteTitle')}
        message={t('modifiers.deleteMessage', { name: deleting?.name ?? '' })}
        confirmLabel={t('common:actions.delete')}
        loading={remove.isPending}
        onConfirm={() => void doDelete()}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
