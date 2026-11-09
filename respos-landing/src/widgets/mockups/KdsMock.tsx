import { useTranslation } from 'react-i18next';
import { cx } from '@/shared/lib/cx';
import { ScreenFrame } from './ScreenFrame';
import styles from './Mockups.module.css';

type TicketState = 'new' | 'cooking' | 'ready';

type Line = [qty: number, dish: string];

/** Illustrative demo tickets; dish names are i18n keys under `mock.dishes`. */
const TICKETS: { table: number; time: string; state: TicketState; items: Line[] }[] = [
  { table: 4, time: '02:15', state: 'new', items: [[2, 'plov'], [1, 'achichuk'], [2, 'tea']] },
  { table: 1, time: '08:40', state: 'cooking', items: [[3, 'shashlik'], [1, 'lagman']] },
  { table: 6, time: '12:05', state: 'ready', items: [[1, 'manti'], [1, 'samsa']] },
];

const STATE_META: Record<TicketState, { labelKey: string; className: string | undefined }> = {
  new: { labelKey: 'mock.ticketNew', className: styles.ticketNew },
  cooking: { labelKey: 'mock.ticketCooking', className: styles.ticketCooking },
  ready: { labelKey: 'mock.ticketReady', className: styles.ticketReady },
};

export function KdsMock({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <ScreenFrame title={t('mock.kds')} className={cx(styles.dark, className)}>
      <div className={styles.kdsGrid}>
        {TICKETS.map((ticket) => {
          const meta = STATE_META[ticket.state];
          return (
            <div key={ticket.table} className={cx(styles.ticket, meta.className)}>
              <div className={styles.ticketHead}>
                <span>
                  {t('mock.table')} {ticket.table}
                </span>
                <span className={styles.ticketTime}>{ticket.time}</span>
              </div>
              <ul className={styles.ticketItems}>
                {ticket.items.map(([qty, dish]) => (
                  <li key={dish}>
                    {qty} × {t(`mock.dishes.${dish}`)}
                  </li>
                ))}
              </ul>
              <span className={styles.ticketStatus}>{t(meta.labelKey)}</span>
            </div>
          );
        })}
      </div>
    </ScreenFrame>
  );
}
