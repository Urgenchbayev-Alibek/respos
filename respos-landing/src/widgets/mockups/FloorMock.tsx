import { useTranslation } from 'react-i18next';
import { cx } from '@/shared/lib/cx';
import { ScreenFrame } from './ScreenFrame';
import styles from './Mockups.module.css';

type TableState = 'free' | 'busy' | 'reserved';

const TABLES: { n: number; seats: 2 | 4 | 6; state: TableState }[] = [
  { n: 1, seats: 2, state: 'busy' },
  { n: 2, seats: 4, state: 'free' },
  { n: 3, seats: 4, state: 'reserved' },
  { n: 4, seats: 6, state: 'busy' },
  { n: 5, seats: 2, state: 'free' },
  { n: 6, seats: 4, state: 'busy' },
  { n: 7, seats: 4, state: 'free' },
  { n: 8, seats: 2, state: 'reserved' },
  { n: 9, seats: 6, state: 'free' },
];

const STATE_CLASS: Record<TableState, string | undefined> = {
  free: styles.tableFree,
  busy: styles.tableBusy,
  reserved: styles.tableReserved,
};

export function FloorMock({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <ScreenFrame title={t('mock.floor')} className={className}>
      <div className={styles.floorHeader}>
        <strong>{t('mock.floorArea')}</strong>
        <span className={styles.legend}>
          <i className={cx(styles.legendDot, styles.tableFree)} /> {t('mock.free')}
          <i className={cx(styles.legendDot, styles.tableBusy)} /> {t('mock.busy')}
          <i className={cx(styles.legendDot, styles.tableReserved)} /> {t('mock.reserved')}
        </span>
      </div>
      <div className={styles.floorGrid}>
        {TABLES.map((table) => (
          <div key={table.n} className={cx(styles.table, STATE_CLASS[table.state], table.seats === 6 && styles.tableWide)}>
            <span className={styles.tableNumber}>{table.n}</span>
            <span className={styles.tableSeats}>{'•'.repeat(table.seats)}</span>
          </div>
        ))}
      </div>
    </ScreenFrame>
  );
}
