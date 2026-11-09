import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActiveOrders } from '@/entities/payment/payment.queries';
import { formatOrderNumber } from '@/features/payments/model/payment-labels';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { EmptyState, ErrorState, SearchInput, Skeleton, StatusBadge } from '@/shared/ui';
import { filterPayableOrders } from '../model/filter-orders';
import styles from './PayableOrderList.module.css';

interface PayableOrderListProps {
  selectedId: string | null;
  onSelect: (orderId: string) => void;
}

/** Active orders with something left to pay; search by number or table. */
export function PayableOrderList({ selectedId, onSelect }: PayableOrderListProps) {
  const { t } = useTranslation('cashier');
  const format = useFormatters();
  const [search, setSearch] = useState('');
  const query = useActiveOrders();
  const orders = useMemo(() => filterPayableOrders(query.data ?? [], search), [query.data, search]);

  return (
    <section className={styles.panel} aria-label={t('orders.title')}>
      <h2>{t('orders.titleCount', { count: orders.length })}</h2>
      <SearchInput value={search} onChange={setSearch} placeholder={t('orders.searchPlaceholder')} />
      {query.isPending ? (
        <Skeleton height={64} />
      ) : query.isError ? (
        <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
      ) : orders.length === 0 ? (
        <EmptyState compact title={t(search ? 'orders.notFound' : 'orders.empty')} />
      ) : (
        <ul className={styles.list}>
          {orders.map((order) => (
            <li key={order.id}>
              <button
                type="button"
                className={styles.order}
                aria-current={order.id === selectedId}
                onClick={() => onSelect(order.id)}
              >
                <span className={styles.number}>
                  {formatOrderNumber(order.number)} ·{' '}
                  {order.tableNumber ? t('orders.table', { number: order.tableNumber }) : t('orders.takeaway')}
                </span>
                <span className={styles.amount}>{format.money(order.remainingAmount)}</span>
                <span className={styles.sub}>
                  <StatusBadge domain="order" status={order.status} />
                  {order.paidAmount > 0 && t('orders.partiallyPaid', { total: format.money(order.total) })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
