import clsx from 'clsx';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { KitchenTicketItemDto, TicketItemAction } from '@/entities/kitchen-ticket/kitchen-ticket.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import styles from './TicketItemRow.module.css';

interface TicketItemRowProps {
  item: KitchenTicketItemDto;
  /** Per-item buttons are shown only in "by item" mode. */
  showActions: boolean;
  pending: boolean;
  onAction: (item: KitchenTicketItemDto, action: TicketItemAction) => void;
}

export function TicketItemRow({ item, showActions, pending, onAction }: TicketItemRowProps) {
  const { t } = useTranslation('kitchen');
  const format = useFormatters();
  const action: TicketItemAction | null = item.status === 'new' ? 'start' : item.status === 'preparing' ? 'ready' : null;
  const name = item.variantName ? `${item.name} (${item.variantName})` : item.name;

  return (
    <li className={clsx(styles.item, styles[item.status])}>
      <span className={styles.qty}>{format.number(item.quantity)}×</span>
      <span className={styles.name}>
        {name}
        {item.status === 'cancelled' && ` — ${t('status:orderItem.cancelled')}`}
      </span>
      {item.modifiers.length > 0 && <span className={styles.detail}>{item.modifiers.join(', ')}</span>}
      {item.comment && <span className={styles.comment}>{item.comment}</span>}
      <span className={styles.side}>
        {item.status === 'ready' && <CheckCircle2 className={styles.check} aria-label={t('status:orderItem.ready')} />}
        {showActions && action && (
          <button
            type="button"
            className={styles.itemBtn}
            disabled={pending}
            aria-label={t(`itemActions.${action}Aria`, { name })}
            onClick={() => onAction(item, action)}
          >
            {t(`itemActions.${action}`)}
          </button>
        )}
      </span>
    </li>
  );
}
