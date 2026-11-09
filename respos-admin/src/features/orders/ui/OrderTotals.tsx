import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { OrderDto } from '@/entities/order/order.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import styles from './OrderTotals.module.css';

export interface OrderTotalsProps {
  order: Pick<
    OrderDto,
    'subtotal' | 'discountAmount' | 'serviceChargeAmount' | 'taxAmount' | 'total' | 'paidAmount' | 'remainingAmount'
  >;
  /** Hide zero discount / service / tax rows (compact waiter panel). */
  compact?: boolean;
}

/** Bill totals exactly as calculated by the server (the UI never recalculates them). */
export function OrderTotals({ order, compact }: OrderTotalsProps) {
  const { t } = useTranslation('orders');
  const format = useFormatters();
  const rows: { key: string; label: string; value: number; show: boolean }[] = [
    { key: 'subtotal', label: t('totals.subtotal'), value: order.subtotal, show: true },
    { key: 'discount', label: t('totals.discount'), value: -order.discountAmount, show: !compact || order.discountAmount !== 0 },
    {
      key: 'service',
      label: t('totals.serviceCharge'),
      value: order.serviceChargeAmount,
      show: !compact || order.serviceChargeAmount !== 0,
    },
    { key: 'tax', label: t('totals.tax'), value: order.taxAmount, show: !compact || order.taxAmount !== 0 },
  ];
  return (
    <dl className={styles.totals}>
      {rows
        .filter((row) => row.show)
        .map((row) => (
          <div key={row.key} className={styles.row}>
            <dt>{row.label}</dt>
            <dd>{format.money(row.value)}</dd>
          </div>
        ))}
      <div className={clsx(styles.row, styles.grand)}>
        <dt>{t('totals.total')}</dt>
        <dd>{format.money(order.total)}</dd>
      </div>
      {order.paidAmount > 0 && (
        <>
          <div className={styles.row}>
            <dt>{t('totals.paid')}</dt>
            <dd>{format.money(order.paidAmount)}</dd>
          </div>
          <div className={clsx(styles.row, styles.remaining)}>
            <dt>{t('totals.remaining')}</dt>
            <dd>{format.money(order.remainingAmount)}</dd>
          </div>
        </>
      )}
    </dl>
  );
}
