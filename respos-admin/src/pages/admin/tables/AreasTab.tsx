import { Archive, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useArchiveDiningArea } from '@/entities/dining-area/dining-area.queries';
import type { DiningAreaDto } from '@/entities/dining-area/dining-area.types';
import { AreaFormModal } from '@/features/floor/ui/AreaFormModal';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Button, ConfirmDialog, DataTable, IconButton, StatusBadge, useToast, type DataTableColumn } from '@/shared/ui';
import styles from './TablesPage.module.css';

export interface AreasTabProps {
  areas: DiningAreaDto[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  canManage: boolean;
}

export function AreasTab({ areas, isLoading, error, onRetry, canManage }: AreasTabProps) {
  const { t } = useTranslation('floor');
  const toast = useToast();
  const archive = useArchiveDiningArea();
  const [editing, setEditing] = useState<DiningAreaDto | null | 'new'>(null);
  const [archiving, setArchiving] = useState<DiningAreaDto | null>(null);
  const nextSortOrder = (areas ?? []).reduce((max, area) => Math.max(max, area.sortOrder), 0) + 1;

  const columns = useMemo<DataTableColumn<DiningAreaDto>[]>(() => {
    const base: DataTableColumn<DiningAreaDto>[] = [
      { key: 'name', header: t('columns.name'), cell: (area) => <strong>{area.name}</strong> },
      { key: 'sortOrder', header: t('columns.sortOrder'), cell: (area) => area.sortOrder, align: 'right', width: '120px' },
      {
        key: 'active',
        header: t('columns.active'),
        cell: (area) => (
          <StatusBadge tone={area.isActive ? 'success' : 'neutral'}>{t(area.isActive ? 'active' : 'inactive')}</StatusBadge>
        ),
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
        cell: (area) => (
          <>
            <IconButton label={t('actions.editArea', { name: area.name })} icon={<Pencil />} onClick={() => setEditing(area)} />
            <IconButton
              label={t('actions.archiveArea', { name: area.name })}
              icon={<Archive />}
              onClick={() => setArchiving(area)}
            />
          </>
        ),
      },
    ];
  }, [t, canManage]);

  const doArchive = async () => {
    if (!archiving) return;
    try {
      await archive.mutateAsync(archiving.id);
      toast.success(t('toast.areaArchived'));
    } catch (err) {
      toast.error(t('toast.actionFailed'), getErrorMessage(err, t));
    } finally {
      setArchiving(null);
    }
  };

  return (
    <>
      {canManage && (
        <div className={styles.barEnd}>
          <Button icon={<Plus />} onClick={() => setEditing('new')}>
            {t('actions.addArea')}
          </Button>
        </div>
      )}
      <DataTable
        caption={t('tabs.areas')}
        columns={columns}
        rows={areas}
        getRowId={(area) => area.id}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        emptyTitle={t('empty.noAreas')}
        emptyDescription={t('empty.noAreasHint')}
      />
      {editing && (
        <AreaFormModal area={editing === 'new' ? null : editing} nextSortOrder={nextSortOrder} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog
        open={archiving !== null}
        title={t('confirm.archiveAreaTitle')}
        message={t('confirm.archiveAreaMessage', { name: archiving?.name ?? '' })}
        confirmLabel={t('actions.archive')}
        loading={archive.isPending}
        onConfirm={() => void doArchive()}
        onCancel={() => setArchiving(null)}
      />
    </>
  );
}
