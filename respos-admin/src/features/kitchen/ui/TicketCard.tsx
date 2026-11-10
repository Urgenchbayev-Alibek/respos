import clsx from 'clsx';
import { Printer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  KitchenTicketDto,
  KitchenTicketItemDto,
  TicketAction,
  TicketItemAction,
} from '@/entities/kitchen-ticket/kitchen-ticket.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { IconButton } from '@/shared/ui';
import { printKitchenTicket } from '../model/print-ticket';
import { formatElapsed, getTicketElapsedMs, getTimerLevel } from '../model/ticket-timer';
import { KitchenTicketPrint } from './KitchenTicketPrint';
import styles from './TicketCard.module.css';
import { TicketItemRow } from './TicketItemRow';

export interface TicketCardProps {
  ticket: KitchenTicketDto;
  now: number;
  highlighted: boolean;
  canUpdate: boolean;
  /** A mutation for this ticket (or one of its items) is running. */
  pending: boolean;
  onAction: (ticket: KitchenTicketDto, action: TicketAction) => void;
  onItemAction: (item: KitchenTicketItemDto, action: TicketItemAction) => void;
}

export function TicketCard({ ticket, now, highlighted, canUpdate, pending, onAction, onItemAction }: TicketCardProps) {
  const { t } = useTranslation('kitchen');
  const format = useFormatters();
  const [byItem, setByItem] = useState(false);
  const isActive = ticket.status === 'new' || ticket.status === 'in_progress';
  const elapsed = getTicketElapsedMs(ticket, now);
  const level = isActive ? getTimerLevel(elapsed) : 'normal';
  const place = ticket.tableNumber ? t('ticket.table', { number: ticket.tableNumber }) : t('ticket.takeaway');
  const orderNumber = String(ticket.orderNumber).padStart(4, '0');

  return (
    <article
      className={clsx(styles.ticket, styles[level], highlighted && styles.highlight, !isActive && styles.done)}
      aria-label={t('ticket.aria', { number: ticket.number, place })}
      data-testid={`ticket-${ticket.id}`}
      data-level={level}
    >
      <div className={styles.head}>
        <h3 className={styles.title}>
          #{ticket.number} · {place}
        </h3>
        <span className={styles.headSide}>
          <span className={styles.timer} data-level={level} title={t(`timer.${level}`)}>
            <span className="visually-hidden">{t('timer.label')} </span>
            {formatElapsed(elapsed)}
          </span>
          <IconButton
            label={t('ux:print.ticketAria', { number: ticket.number })}
            icon={<Printer />}
            onClick={() => printKitchenTicket(ticket.id)}
          />
        </span>
      </div>
      <p className={styles.meta}>
        {highlighted && <span className={styles.newBadge}>{t('ticket.newBadge')}</span>}
        {t('ticket.meta', {
          waiter: ticket.waiterName ?? '—',
          order: orderNumber,
          time: format.time(ticket.createdAt),
        })}
        {ticket.status === 'ready' && ticket.readyAt && ` · ${t('ticket.readyAt', { time: format.time(ticket.readyAt) })}`}
      </p>
      <ul className={styles.items}>
        {ticket.items.map((item) => (
          <TicketItemRow
            key={item.id}
            item={item}
            showActions={canUpdate && isActive && byItem}
            pending={pending}
            onAction={onItemAction}
          />
        ))}
      </ul>
      <KitchenTicketPrint ticket={ticket} />
      {canUpdate && <TicketActions ticket={ticket} pending={pending} byItem={byItem} onToggleByItem={() => setByItem((v) => !v)} onAction={onAction} />}
    </article>
  );
}

interface TicketActionsProps {
  ticket: KitchenTicketDto;
  pending: boolean;
  byItem: boolean;
  onToggleByItem: () => void;
  onAction: (ticket: KitchenTicketDto, action: TicketAction) => void;
}

function TicketActions({ ticket, pending, byItem, onToggleByItem, onAction }: TicketActionsProps) {
  const { t } = useTranslation('kitchen');
  const button = (action: TicketAction, className: string | undefined) => (
    <button type="button" className={clsx(styles.btn, className)} disabled={pending} onClick={() => onAction(ticket, action)}>
      {t(`actions.${action}`)}
    </button>
  );
  const byItemToggle = (
    <button type="button" className={clsx(styles.btn, styles.ghost)} aria-pressed={byItem} onClick={onToggleByItem}>
      {t('actions.byItem')}
    </button>
  );

  if (ticket.status === 'new') {
    return (
      <div className={styles.actions}>
        {button('start', styles.start)}
        {byItemToggle}
      </div>
    );
  }
  if (ticket.status === 'in_progress') {
    return (
      <div className={styles.actions}>
        {button('ready', styles.ready)}
        {byItemToggle}
      </div>
    );
  }
  if (ticket.status === 'ready') {
    return (
      <div className={styles.actions}>
        {button('served', styles.ready)}
        {button('recall', styles.ghost)}
      </div>
    );
  }
  return null;
}
