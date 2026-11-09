import clsx from 'clsx';
import { CalendarClock, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TableDto } from '@/entities/table/table.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { StatusBadge } from '@/shared/ui';
import styles from './TableTile.module.css';

export interface TableTileProps {
  table: TableDto;
  onSelect?: (table: TableDto) => void;
  /** Extra controls rendered next to (not inside) the tile button, e.g. a row-actions menu. */
  actions?: ReactNode;
  /** Highlight (e.g. a dish is ready for this table). */
  highlight?: boolean;
  size?: 'md' | 'lg';
}

/** Floor-plan tile: number, seats, status colour, active order total, next reservation. */
export function TableTile({ table, onSelect, actions, highlight, size = 'md' }: TableTileProps) {
  const { t } = useTranslation('floor');
  const format = useFormatters();
  const statusLabel = t(`status:table.${table.status}`);
  const content = (
    <>
      <span className={styles.top}>
        <span className={styles.number}>{table.number}</span>
        <span className={styles.seats}>
          <Users aria-hidden="true" />
          {table.capacity}
        </span>
      </span>
      <StatusBadge domain="table" status={table.status} size="sm" />
      {table.activeOrderTotal !== null && table.activeOrderTotal !== undefined && (
        <span className={styles.total}>{format.money(table.activeOrderTotal)}</span>
      )}
      {table.nextReservation && (
        <span className={styles.reservation}>
          <CalendarClock aria-hidden="true" />
          {format.time(table.nextReservation.startsAt)} · {table.nextReservation.guestName}
        </span>
      )}
    </>
  );
  const label = t('tile.label', { number: table.number, status: statusLabel, seats: table.capacity });

  return (
    <div
      className={clsx(
        styles.tile,
        styles[table.status],
        styles[size],
        highlight && styles.highlight,
        !table.isActive && styles.inactive,
      )}
      data-testid={`table-tile-${table.number}`}
      data-status={table.status}
    >
      {onSelect ? (
        <button type="button" className={styles.body} onClick={() => onSelect(table)} aria-label={label}>
          {content}
        </button>
      ) : (
        <div className={styles.body} aria-label={label} role="group">
          {content}
        </div>
      )}
      {actions && <span className={styles.actions}>{actions}</span>}
    </div>
  );
}
