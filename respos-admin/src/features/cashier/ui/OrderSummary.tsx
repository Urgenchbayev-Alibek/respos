import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { OrderDto } from '@/entities/order/order.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import styles from './OrderSummary.module.css';

/** Order lines and SERVER totals (subtotal, discount, service, tax, delivery fee, total, paid, remaining). */
/** Shared by the payment panel (OrderDto) and the pre-check (ReceiptDto). */
export type OrderSummaryData = Pick<
  OrderDto,
  | 'items'
  | 'subtotal'
  | 'discountAmount'
  | 'serviceChargeAmount'
  | 'taxAmount'
  | 'deliveryFee'
  | 'total'
  | 'paidAmount'
  | 'remainingAmount'
>;

export function OrderSummary({ order }: { order: OrderSummaryData }) {
  const { t } = useTranslation('cashier');
  const format = useFormatters();
  const settled = order.remainingAmount <= 0;
  const rows: { key: string; label: string; value: number | string; className?: string }[] = [
    { key: 'subtotal', label: t('summary.subtotal'), value: order.subtotal },
    { key: 'discount', label: t('summary.discount'), value: order.discountAmount },
    { key: 'service', label: t('summary.serviceCharge'), value: order.serviceChargeAmount },
    { key: 'tax', label: t('summary.tax'), value: order.taxAmount },
    // Delivery orders only: without this line the rows above would not add up to the total.
    ...(order.deliveryFee ? [{ key: 'delivery', label: t('summary.deliveryFee'), value: order.deliveryFee }] : []),
    { key: 'total', label: t('summary.total'), value: order.total, className: styles.grand },
    { key: 'paid', label: t('summary.paid'), value: order.paidAmount },
    { key: 'remaining', label: t('summary.remaining'), value: settled ? t('summary.settled') : order.remainingAmount, className: settled ? styles.settled : styles.remaining },
  ];

  return (
    <>
      <ul className={styles.items}>
        {order.items.map((item) => (
          <li key={item.id} className={clsx(styles.item, item.status === 'cancelled' && styles.cancelled)}>
            <span>
              {item.name}
              {item.variantName && ` (${item.variantName})`} × {format.number(item.quantity)}
              {item.modifiers.length > 0 && (
                <span className={styles.detail}>{item.modifiers.map((modifier) => `+ ${modifier.name}`).join(', ')}</span>
              )}
            </span>
            <span className={styles.money}>{format.money(item.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className={styles.totals}>
        {rows.map((row) => (
          <div key={row.key} className={row.className} data-testid={`summary-${row.key}`}>
            <dt>{row.label}</dt>
            <dd>{typeof row.value === 'number' ? format.money(row.value) : row.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
