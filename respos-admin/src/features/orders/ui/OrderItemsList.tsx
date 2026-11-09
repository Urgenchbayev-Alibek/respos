import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderItemDto } from '@/entities/order/order.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { StatusBadge } from '@/shared/ui';
import styles from './OrderItemsList.module.css';

export interface OrderItemsListProps {
  items: OrderItemDto[];
  /** Per-item extra controls (e.g. "Served" button in the waiter workspace). */
  renderActions?: (item: OrderItemDto) => ReactNode;
}

/** Order lines with snapshot names, modifiers, comment, status and server line totals. */
export function OrderItemsList({ items, renderActions }: OrderItemsListProps) {
  const { t } = useTranslation('orders');
  const format = useFormatters();
  if (items.length === 0) return <p className={styles.empty}>{t('noItems')}</p>;
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id} className={styles.item} data-status={item.status}>
          <div className={styles.top}>
            <span className={item.status === 'cancelled' ? styles.cancelled : undefined}>
              {item.name}
              {item.variantName && <span className={styles.variant}> · {item.variantName}</span>}
            </span>
            <StatusBadge domain="orderItem" status={item.status} size="sm" />
          </div>
          {item.modifiers.length > 0 && (
            <div className={styles.mods}>
              {item.modifiers
                .map((modifier) =>
                  modifier.priceDelta ? `+ ${modifier.name} (${format.money(modifier.priceDelta)})` : `+ ${modifier.name}`,
                )
                .join(', ')}
            </div>
          )}
          {item.comment && <div className={styles.comment}>{item.comment}</div>}
          <div className={styles.bottom}>
            <span className={styles.meta}>
              ×{format.number(item.quantity)} · {format.money(item.unitPrice)}
              {item.sentAt && ` · ${t('sentAt', { time: format.time(item.sentAt) })}`}
            </span>
            <span className={styles.bottomEnd}>
              {renderActions?.(item)}
              <span className={styles.sum}>{format.money(item.lineTotal)}</span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
