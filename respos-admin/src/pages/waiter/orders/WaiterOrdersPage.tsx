import clsx from 'clsx';
import { Clock, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useActiveOrders } from '@/entities/order/order.queries';
import { formatOrderNumber } from '@/entities/order/order.types';
import { useWaiterRealtime } from '@/features/waiter-order/model/use-waiter-realtime';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { buildPath, ROUTES } from '@/shared/constants/routes';
import { useAuth } from '@/shared/hooks/use-auth';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { minutesSince } from '@/shared/lib/format-date';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge, Tabs } from '@/shared/ui';
import styles from './WaiterOrdersPage.module.css';

type Scope = 'mine' | 'all';

/** Active (not paid / cancelled) orders of the branch; "Mine" by default. */
export function WaiterOrdersPage() {
  const { t } = useTranslation('waiter');
  const format = useFormatters();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [scope, setScope] = useState<Scope>('mine');
  const orders = useActiveOrders();
  useWaiterRealtime();

  const list = (orders.data ?? [])
    .filter((order) => scope === 'all' || order.waiterId === user?.id)
    .sort((a, b) => Date.parse(a.openedAt) - Date.parse(b.openedAt));

  const renderList = () => {
    if (orders.error && !orders.data) return <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />;
    if (orders.isLoading) return <Skeleton height={200} radius="var(--radius-md)" />;
    if (list.length === 0) return <EmptyState title={t('orders.empty')} description={t('orders.emptyHint')} />;
    return (
      <ul className={styles.list}>
        {list.map((order) => (
          <li key={order.id}>
            <Link
              to={buildPath(ROUTES.waiter.order, { orderId: order.id })}
              className={clsx(styles.card, order.status === 'ready' && styles.ready)}
            >
              <span className={styles.top}>
                <strong className={styles.place}>
                  {order.type === 'takeaway' ? t('order.takeaway') : t('order.table', { number: order.tableNumber ?? '—' })}
                </strong>
                <StatusBadge domain="order" status={order.status} />
              </span>
              <span className={styles.meta}>
                {formatOrderNumber(order.number)}
                {scope === 'all' && order.waiterName && ` · ${order.waiterName}`}
              </span>
              <span className={styles.bottom}>
                <span className={styles.time}>
                  <Clock aria-hidden="true" />
                  {t('orders.minutes', { n: minutesSince(order.openedAt) })}
                </span>
                <span className={styles.total}>{format.money(order.total)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <>
      <PageHeader
        title={t('orders.title')}
        actions={
          hasPermission(PERMISSIONS.orders.create) && (
            <Button size="lg" icon={<ShoppingBag />} onClick={() => navigate(`${ROUTES.waiter.newOrder}?type=takeaway&guests=1`)}>
              {t('floor.takeaway')}
            </Button>
          )
        }
      />
      <Tabs
        ariaLabel={t('orders.title')}
        value={scope}
        onChange={(id) => setScope(id as Scope)}
        items={[
          { id: 'mine', label: t('orders.mine') },
          { id: 'all', label: t('orders.all') },
        ]}
      />
      {renderList()}
    </>
  );
}
