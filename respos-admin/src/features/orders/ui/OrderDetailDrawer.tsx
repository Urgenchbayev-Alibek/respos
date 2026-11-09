import { Ban } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCancelOrder, useOrder } from '@/entities/order/order.queries';
import { formatOrderNumber, isOrderOpen, type OrderDto } from '@/entities/order/order.types';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Button, ConfirmDialog, Drawer, ErrorState, Skeleton, StatusBadge, useToast } from '@/shared/ui';
import styles from './OrderDetailDrawer.module.css';
import { OrderItemsList } from './OrderItemsList';
import { OrderTotals } from './OrderTotals';

export interface OrderDetailDrawerProps {
  orderId: string;
  onClose: () => void;
}

/** Order details: items with statuses, server totals, status history, payments; cancel with reason. */
export function OrderDetailDrawer({ orderId, onClose }: OrderDetailDrawerProps) {
  const { t } = useTranslation('orders');
  const toast = useToast();
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const order = useOrder(orderId);
  const cancel = useCancelOrder();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const data = order.data;
  const canCancel = Boolean(data && hasPermission(PERMISSIONS.orders.cancel) && isOrderOpen(data) && data.paidAmount === 0);

  const doCancel = async (reason: string) => {
    try {
      await cancel.mutateAsync({ orderId, reason });
      toast.success(t('toast.cancelled'));
      setConfirmCancel(false);
    } catch (error) {
      toast.error(t('toast.actionFailed'), getErrorMessage(error, t));
    }
  };

  const renderBody = (value: OrderDto) => (
    <>
      <div className={styles.meta}>
        <StatusBadge domain="order" status={value.status} size="lg" />
        <span>{t(`type.${value.type}`)}</span>
        {value.tableNumber && <span>{t('tableLabel', { number: value.tableNumber })}</span>}
        <span>{t('guests', { guests: value.guestCount })}</span>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>{t('columns.waiter')}</dt>
          <dd>{value.waiterName ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('columns.openedAt')}</dt>
          <dd>{format.dateTime(value.openedAt)}</dd>
        </div>
        {value.closedAt && (
          <div>
            <dt>{t('closedAt')}</dt>
            <dd>{format.dateTime(value.closedAt)}</dd>
          </div>
        )}
        {value.cancelReason && (
          <div>
            <dt>{t('cancelReason')}</dt>
            <dd>{value.cancelReason}</dd>
          </div>
        )}
        {value.comment && (
          <div>
            <dt>{t('comment')}</dt>
            <dd>{value.comment}</dd>
          </div>
        )}
      </dl>
      <section className={styles.section}>
        <h3 className={styles.heading}>{t('sections.items')}</h3>
        <OrderItemsList items={value.items} />
      </section>
      <section className={styles.section}>
        <OrderTotals order={value} />
      </section>
      <section className={styles.section}>
        <h3 className={styles.heading}>{t('sections.payments')}</h3>
        {value.payments.length === 0 ? (
          <p className={styles.muted}>{t('noPayments')}</p>
        ) : (
          <ul className={styles.simpleList}>
            {value.payments.map((payment) => (
              <li key={payment.id}>
                <span>
                  {t(`method.${payment.method}`)} · {format.dateTime(payment.createdAt)}
                  {payment.createdByName && ` · ${payment.createdByName}`}
                </span>
                <span className={styles.amount}>
                  {format.money(payment.amount)} <StatusBadge domain="payment" status={payment.status} size="sm" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={styles.section}>
        <h3 className={styles.heading}>{t('sections.history')}</h3>
        <ol className={styles.simpleList}>
          {value.history.map((entry, index) => (
            <li key={`${entry.changedAt}-${index}`}>
              <span>
                {entry.fromStatus ? `${t(`status:order.${entry.fromStatus}`)} → ` : ''}
                {t(`status:order.${entry.toStatus}`)}
                {entry.reason && <em className={styles.muted}> · {entry.reason}</em>}
              </span>
              <span className={styles.muted}>
                {format.dateTime(entry.changedAt)}
                {entry.changedByName && ` · ${entry.changedByName}`}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );

  return (
    <Drawer
      open
      width={520}
      onClose={onClose}
      title={t('detailTitle', { number: formatOrderNumber(data?.number) })}
      footer={
        canCancel && (
          <Button variant="danger" icon={<Ban />} onClick={() => setConfirmCancel(true)}>
            {t('actions.cancel')}
          </Button>
        )
      }
    >
      {order.error && !data && <ErrorState error={order.error} onRetry={() => void order.refetch()} />}
      {!data && !order.error && <Skeleton height={320} />}
      {data && renderBody(data)}
      <ConfirmDialog
        open={confirmCancel}
        title={t('confirm.cancelTitle')}
        message={t('confirm.cancelMessage')}
        confirmLabel={t('actions.cancel')}
        withReason
        reasonRequired
        loading={cancel.isPending}
        onConfirm={(reason) => void doCancel(reason)}
        onCancel={() => setConfirmCancel(false)}
      />
    </Drawer>
  );
}
