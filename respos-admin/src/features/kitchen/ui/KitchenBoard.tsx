import { useTranslation } from 'react-i18next';
import type { KitchenTicketDto } from '@/entities/kitchen-ticket/kitchen-ticket.types';
import type { TicketStatus } from '@/shared/constants/statuses';
import styles from './KitchenBoard.module.css';
import { TicketCard, type TicketCardProps } from './TicketCard';

type CardHandlers = Pick<TicketCardProps, 'now' | 'canUpdate' | 'onAction' | 'onItemAction'>;

interface KitchenBoardProps extends CardHandlers {
  tickets: KitchenTicketDto[];
  layout: 'columns' | 'served';
  highlighted: ReadonlySet<string>;
  isPending: (ticket: KitchenTicketDto) => boolean;
}

const COLUMNS: readonly TicketStatus[] = ['new', 'in_progress', 'ready'];

export function KitchenBoard({ tickets, layout, highlighted, isPending, ...handlers }: KitchenBoardProps) {
  const { t } = useTranslation('kitchen');
  const card = (ticket: KitchenTicketDto) => (
    <TicketCard
      key={ticket.id}
      ticket={ticket}
      highlighted={highlighted.has(ticket.id)}
      pending={isPending(ticket)}
      {...handlers}
    />
  );

  if (layout === 'served') return <div className={styles.served}>{tickets.map(card)}</div>;

  return (
    <div className={styles.board}>
      {COLUMNS.map((status) => {
        const list = tickets.filter((ticket) => ticket.status === status);
        return (
          <section key={status} className={styles.column} aria-label={t(`columns.${status}`)}>
            <h2>
              {t(`columns.${status}`)} <span className={styles.count}>{list.length}</span>
            </h2>
            <div className={styles.stack}>
              {list.length === 0 ? <p className={styles.columnEmpty}>{t('columnEmpty')}</p> : list.map(card)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
