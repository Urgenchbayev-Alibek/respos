import { useTranslation } from 'react-i18next';
import type { KitchenTicketDto } from '@/entities/kitchen-ticket/kitchen-ticket.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { PrintArea, PrintDivider } from '@/shared/ui';
import { kitchenTicketPrintId } from '../model/print-ticket';
import styles from './KitchenTicketPrint.module.css';

/** 80 mm kitchen ticket (station chit): big table/number, items with modifiers and comments. */
export function KitchenTicketPrint({ ticket }: { ticket: KitchenTicketDto }) {
  return (
    <PrintArea id={kitchenTicketPrintId(ticket.id)}>
      <KitchenTicketSlip ticket={ticket} />
    </PrintArea>
  );
}

export function KitchenTicketSlip({ ticket }: { ticket: KitchenTicketDto }) {
  const { t } = useTranslation('ux');
  const format = useFormatters();
  const place = ticket.tableNumber ? t('kitchen:ticket.table', { number: ticket.tableNumber }) : t('kitchen:ticket.takeaway');

  return (
    <div className={styles.slip}>
      <h2 className={styles.place}>{place}</h2>
      <p className={styles.center}>{t('kitchenTicket.title', { number: ticket.number })}</p>
      <PrintDivider />
      <p>{t('kitchenTicket.station', { name: ticket.stationName })}</p>
      <p>{t('kitchenTicket.order', { number: String(ticket.orderNumber).padStart(4, '0') })}</p>
      <p>{t('kitchenTicket.waiter', { name: ticket.waiterName ?? '—' })}</p>
      <p>{t('kitchenTicket.created', { time: format.dateTime(ticket.createdAt) })}</p>
      <PrintDivider />
      <ul className={styles.items}>
        {ticket.items.map((item) => (
          <li key={item.id} className={item.status === 'cancelled' ? styles.cancelled : undefined}>
            <strong>
              {format.number(item.quantity)} × {item.variantName ? `${item.name} (${item.variantName})` : item.name}
            </strong>
            {item.status === 'cancelled' && ` — ${t('kitchenTicket.cancelled')}`}
            {item.modifiers.length > 0 && <div>+ {item.modifiers.join(', ')}</div>}
            {item.comment && <div className={styles.comment}>! {item.comment}</div>}
          </li>
        ))}
      </ul>
      <PrintDivider />
      <p className={styles.center}>{t('print.printedAt', { time: format.dateTime(new Date()) })}</p>
    </div>
  );
}
