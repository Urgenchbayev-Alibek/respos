import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeleteKitchenStation, useKitchenStations } from '@/entities/kitchen-station/kitchen-station.queries';
import type { KitchenStationDto } from '@/entities/kitchen-station/kitchen-station.types';
import { StationFormModal } from '@/features/kitchen-stations/ui/StationFormModal';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import {
  Button,
  ConfirmDialog,
  DataTable,
  IconButton,
  PageHeader,
  StatusBadge,
  useToast,
  type DataTableColumn,
} from '@/shared/ui';

/** Kitchen stations of the current branch (KDS routing + default station for items without one). */
export function KitchenStationsPage() {
  const { t } = useTranslation('kitchenStations');
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.kitchen.stationsManage);
  const stations = useKitchenStations();
  const remove = useDeleteKitchenStation();
  const [editing, setEditing] = useState<KitchenStationDto | null | 'new'>(null);
  const [deleting, setDeleting] = useState<KitchenStationDto | null>(null);
  const nextSortOrder = (stations.data ?? []).reduce((max, station) => Math.max(max, station.sortOrder), 0) + 1;

  const columns = useMemo<DataTableColumn<KitchenStationDto>[]>(() => {
    const base: DataTableColumn<KitchenStationDto>[] = [
      { key: 'name', header: t('columns.name'), cell: (station) => <strong>{station.name}</strong> },
      { key: 'sortOrder', header: t('columns.sortOrder'), cell: (station) => station.sortOrder, align: 'right', width: '120px' },
      {
        key: 'status',
        header: t('columns.status'),
        cell: (station) => (
          <StatusBadge tone={station.isActive ? 'success' : 'neutral'}>{t(station.isActive ? 'active' : 'inactive')}</StatusBadge>
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
        cell: (station) => (
          <>
            <IconButton label={t('actions.edit', { name: station.name })} icon={<Pencil />} onClick={() => setEditing(station)} />
            <IconButton
              label={t('actions.delete', { name: station.name })}
              icon={<Trash2 />}
              onClick={() => setDeleting(station)}
            />
          </>
        ),
      },
    ];
  }, [t, canManage]);

  const doDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success(t('toast.deleted'));
    } catch (error) {
      toast.error(t('toast.deleteFailed'), getErrorMessage(error, t));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          canManage && (
            <Button variant="primary" icon={<Plus />} onClick={() => setEditing('new')}>
              {t('actions.create')}
            </Button>
          )
        }
      />
      <DataTable
        caption={t('title')}
        columns={columns}
        rows={stations.data}
        getRowId={(station) => station.id}
        isLoading={stations.isFetching}
        error={stations.error}
        onRetry={() => void stations.refetch()}
        emptyTitle={t('empty')}
        emptyDescription={t('emptyHint')}
      />
      {editing && (
        <StationFormModal
          station={editing === 'new' ? null : editing}
          nextSortOrder={nextSortOrder}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={t('confirm.deleteTitle')}
        message={t('confirm.deleteMessage', { name: deleting?.name ?? '' })}
        confirmLabel={t('common:actions.delete')}
        loading={remove.isPending}
        onConfirm={() => void doDelete()}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
