import { ShoppingBag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDiningAreas } from '@/entities/dining-area/dining-area.queries';
import { useActiveOrders } from '@/entities/order/order.queries';
import { useTables } from '@/entities/table/table.queries';
import type { TableDto } from '@/entities/table/table.types';
import { ALL_AREAS, AreaFilter } from '@/features/floor/ui/AreaFilter';
import { FloorGrid } from '@/features/floor/ui/FloorGrid';
import { TableTile } from '@/features/floor/ui/TableTile';
import { useWaiterRealtime } from '@/features/waiter-order/model/use-waiter-realtime';
import { GuestCountDialog } from '@/features/waiter-order/ui/GuestCountDialog';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { buildPath, ROUTES } from '@/shared/constants/routes';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge, useToast } from '@/shared/ui';
import styles from './WaiterFloorPage.module.css';

const READY_STATUSES = new Set(['ready', 'partially_ready']);

/** Waiter home: live floor plan. Tap a table → its open order, or a new order after the guest count. */
export function WaiterFloorPage() {
  const { t } = useTranslation('waiter');
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(PERMISSIONS.orders.create);
  const [areaId, setAreaId] = useState(ALL_AREAS);
  const [opening, setOpening] = useState<TableDto | null>(null);
  const areas = useDiningAreas();
  const tables = useTables();
  const activeOrders = useActiveOrders();
  useWaiterRealtime();

  const readyTables = useMemo(
    () =>
      new Set((activeOrders.data ?? []).filter((o) => READY_STATUSES.has(o.status) && o.tableId).map((o) => o.tableId as string)),
    [activeOrders.data],
  );
  const visible = (tables.data ?? []).filter((table) => table.isActive && (areaId === ALL_AREAS || table.areaId === areaId));

  const select = (table: TableDto) => {
    if (table.activeOrderId) {
      navigate(buildPath(ROUTES.waiter.order, { orderId: table.activeOrderId }));
      return;
    }
    if (table.status === 'unavailable') {
      toast.info(t('floor.unavailable', { number: table.number }));
      return;
    }
    if (!canCreate) return;
    setOpening(table);
  };

  const openOrder = (guests: number) => {
    if (!opening) return;
    navigate(`${ROUTES.waiter.newOrder}?tableId=${encodeURIComponent(opening.id)}&guests=${guests}`);
  };

  const renderGrid = () => {
    if (tables.error && !tables.data) return <ErrorState error={tables.error} onRetry={() => void tables.refetch()} />;
    if (tables.isLoading) {
      return (
        <div className={styles.skeleton} aria-busy="true">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} height={128} radius="var(--radius-md)" />
          ))}
        </div>
      );
    }
    if (visible.length === 0) return <EmptyState title={t('floor.empty')} description={t('floor.emptyHint')} />;
    return (
      <FloorGrid
        label={t('floor.title')}
        tables={visible}
        renderTile={(table) => <TableTile table={table} size="lg" highlight={readyTables.has(table.id)} onSelect={select} />}
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t('floor.title')}
        actions={
          canCreate && (
            <Button size="lg" icon={<ShoppingBag />} onClick={() => navigate(`${ROUTES.waiter.newOrder}?type=takeaway&guests=1`)}>
              {t('floor.takeaway')}
            </Button>
          )
        }
        meta={readyTables.size > 0 && <StatusBadge tone="success">{t('floor.readyBadge', { n: readyTables.size })}</StatusBadge>}
      />
      <AreaFilter areas={areas.data ?? []} value={areaId} onChange={setAreaId} />
      {renderGrid()}
      {opening && (
        <GuestCountDialog
          title={t('order.table', { number: opening.number })}
          initial={Math.min(2, opening.capacity)}
          onConfirm={openOrder}
          onClose={() => setOpening(null)}
        />
      )}
    </>
  );
}
