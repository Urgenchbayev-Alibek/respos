import { useQueryClient } from '@tanstack/react-query';
import { Plus, QrCode } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDiningAreas } from '@/entities/dining-area/dining-area.queries';
import { tableKeys, useTables } from '@/entities/table/table.queries';
import type { TableDto } from '@/entities/table/table.types';
import { ALL_AREAS, AreaFilter } from '@/features/floor/ui/AreaFilter';
import { FloorGrid } from '@/features/floor/ui/FloorGrid';
import { TableFormModal } from '@/features/floor/ui/TableFormModal';
import { TableRowActions } from '@/features/floor/ui/TableRowActions';
import { TableTile } from '@/features/floor/ui/TableTile';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';
import { TABLE_STATUSES, type TableStatus } from '@/shared/constants/statuses';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { useRealtimeEvent } from '@/shared/realtime';
import { Button, EmptyState, ErrorState, PageHeader, Select, Skeleton, Tabs } from '@/shared/ui';
import { AreasTab } from './AreasTab';
import { TablesListView } from './TablesListView';
import styles from './TablesPage.module.css';

type View = 'floor' | 'list' | 'areas';

/** Admin: dining areas + tables (floor plan grid with status colours, list view, areas CRUD). */
export function TablesPage() {
  const { t } = useTranslation('floor');
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.tables.manage);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [view, setView] = useState<View>('floor');
  const [areaId, setAreaId] = useState(ALL_AREAS);
  const [status, setStatus] = useState<TableStatus | ''>('');
  const [editing, setEditing] = useState<TableDto | null | 'new'>(null);
  const areas = useDiningAreas();
  const tables = useTables();

  useRealtimeEvent('TableUpdated', () => void queryClient.invalidateQueries({ queryKey: tableKeys.all }));

  const visible = useMemo(
    () =>
      (tables.data ?? []).filter(
        (table) => (areaId === ALL_AREAS || table.areaId === areaId) && (!status || table.status === status),
      ),
    [tables.data, areaId, status],
  );

  const areaList = areas.data ?? [];
  const noAreas = areas.isSuccess && areaList.length === 0;

  const renderFloor = () => {
    if (tables.error && !tables.data) return <ErrorState error={tables.error} onRetry={() => void tables.refetch()} />;
    if (tables.isLoading) {
      return (
        <div className={styles.skeletonGrid} aria-busy="true">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} height={112} radius="var(--radius-md)" />
          ))}
        </div>
      );
    }
    if (visible.length === 0) {
      return (
        <EmptyState
          title={t('empty.noTables')}
          description={canManage ? t('empty.noTablesHint') : undefined}
          action={
            canManage &&
            !noAreas && (
              <Button icon={<Plus />} onClick={() => setEditing('new')}>
                {t('actions.addTable')}
              </Button>
            )
          }
        />
      );
    }
    return (
      <FloorGrid
        label={t('floorLabel')}
        tables={visible}
        renderTile={(table) => (
          <TableTile
            table={table}
            onSelect={canManage ? setEditing : undefined}
            actions={canManage && <TableRowActions table={table} onEdit={setEditing} />}
          />
        )}
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          canManage && (
            <>
              <Button icon={<QrCode />} onClick={() => navigate(ROUTES.admin.tableQr)}>
                {t('qrMenu:sheet.open')}
              </Button>
              <Button variant="primary" icon={<Plus />} disabled={noAreas} onClick={() => setEditing('new')}>
                {t('actions.addTable')}
              </Button>
            </>
          )
        }
      />
      <Tabs
        ariaLabel={t('title')}
        value={view}
        onChange={(id) => setView(id as View)}
        items={[
          { id: 'floor', label: t('tabs.floor') },
          { id: 'list', label: t('tabs.list') },
          { id: 'areas', label: t('tabs.areas') },
        ]}
      />
      {view === 'areas' ? (
        <AreasTab
          areas={areas.data}
          isLoading={areas.isFetching}
          error={areas.error}
          onRetry={() => void areas.refetch()}
          canManage={canManage}
        />
      ) : noAreas ? (
        <EmptyState
          title={t('empty.noAreas')}
          description={t('empty.noAreasHint')}
          action={canManage && <Button onClick={() => setView('areas')}>{t('actions.goToAreas')}</Button>}
        />
      ) : (
        <>
          <div className={styles.bar}>
            <AreaFilter areas={areaList} value={areaId} onChange={setAreaId} />
            <Select
              className={styles.filter}
              aria-label={t('columns.status')}
              placeholder={t('filters.allStatuses')}
              value={status}
              onChange={(event) => setStatus(event.target.value as TableStatus | '')}
              options={TABLE_STATUSES.map((value) => ({ value, label: t(`status:table.${value}`) }))}
            />
          </div>
          {view === 'floor' ? (
            renderFloor()
          ) : (
            <TablesListView
              tables={tables.data ? visible : undefined}
              isLoading={tables.isFetching}
              error={tables.error}
              onRetry={() => void tables.refetch()}
              onEdit={canManage ? setEditing : undefined}
            />
          )}
        </>
      )}
      {editing && (
        <TableFormModal
          table={editing === 'new' ? null : editing}
          areas={areaList}
          defaultAreaId={areaId === ALL_AREAS ? undefined : areaId}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
