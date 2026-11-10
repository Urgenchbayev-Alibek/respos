import { useQueryClient } from '@tanstack/react-query';
import { Bike, Plus, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deliveryKeys, useCouriers, useDeliveryBoard } from '@/entities/delivery/delivery.queries';
import { BOARD_COLUMNS, boardColumnOf, type BoardColumn, type DeliveryOrderDto } from '@/entities/delivery/delivery.types';
import { CouriersModal } from '@/features/delivery/ui/CouriersModal';
import { CreateDeliveryModal } from '@/features/delivery/ui/CreateDeliveryModal';
import { DeliveryCard } from '@/features/delivery/ui/DeliveryCard';
import styles from '@/features/delivery/ui/Delivery.module.css';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { useRealtimeEvent } from '@/shared/realtime';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '@/shared/ui';

const TICK_MS = 30_000;

/** Delivery kanban (admin + cashier): columns per status, live via DeliveryUpdated / OrderUpdated. */
export function DeliveryBoardPage() {
  const { t } = useTranslation('delivery');
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.delivery.manage);
  const queryClient = useQueryClient();
  const board = useDeliveryBoard();
  const couriers = useCouriers();
  const [creating, setCreating] = useState(false);
  const [managingCouriers, setManagingCouriers] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);
  const refetch = () => void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
  useRealtimeEvent('DeliveryUpdated', refetch);
  useRealtimeEvent('OrderUpdated', refetch);
  useRealtimeEvent('PaymentRegistered', refetch);

  const columns = useMemo(() => {
    const grouped = new Map<BoardColumn, DeliveryOrderDto[]>(BOARD_COLUMNS.map((c) => [c, []]));
    (board.data ?? []).forEach((delivery) => grouped.get(boardColumnOf(delivery.status))?.push(delivery));
    return grouped;
  }, [board.data]);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          canManage && (
            <>
              <Button icon={<Users />} onClick={() => setManagingCouriers(true)}>
                {t('couriers.title')}
              </Button>
              <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
                {t('create.title')}
              </Button>
            </>
          )
        }
      />
      {board.isLoading && <Skeleton height={240} />}
      {board.error && <ErrorState error={board.error} onRetry={() => void board.refetch()} />}
      {board.data && board.data.length === 0 && (
        <EmptyState icon={<Bike />} title={t('empty.title')} description={canManage ? t('empty.description') : undefined} />
      )}
      {board.data && board.data.length > 0 && (
        <div className={styles.board}>
          {BOARD_COLUMNS.map((column) => {
            const items = columns.get(column) ?? [];
            return (
              <section key={column} className={styles.column} aria-label={t(`columns.${column}`)}>
                <h2 className={styles.columnTitle}>
                  <span>{t(`columns.${column}`)}</span>
                  <span>{items.length}</span>
                </h2>
                {items.map((delivery) => (
                  <DeliveryCard key={delivery.orderId} delivery={delivery} couriers={couriers.data ?? []} canManage={canManage} now={now} />
                ))}
              </section>
            );
          })}
        </div>
      )}
      {canManage && <CreateDeliveryModal open={creating} onClose={() => setCreating(false)} />}
      {canManage && managingCouriers && <CouriersModal open onClose={() => setManagingCouriers(false)} />}
    </>
  );
}
