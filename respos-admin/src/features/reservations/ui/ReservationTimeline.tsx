import clsx from 'clsx';
import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReservationDto } from '@/entities/reservation/reservation.types';
import type { TableDto } from '@/entities/table/table.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { utcToZonedParts } from '@/shared/lib/zoned-time';
import styles from './ReservationTimeline.module.css';

export interface ReservationTimelineProps {
  /** Selected day `YYYY-MM-DD` (branch timezone). */
  date: string;
  reservations: ReservationDto[];
  tables: TableDto[];
  highlightIds?: ReadonlySet<string>;
  onSelect: (reservation: ReservationDto) => void;
}

const DEFAULT_START = 10;
const DEFAULT_END = 24;
const NO_TABLE = '__none__';

/** Day view: tables × hours, a block per reservation (branch timezone). */
export function ReservationTimeline({ date, reservations, tables, highlightIds, onSelect }: ReservationTimelineProps) {
  const { t } = useTranslation('reservations');
  const format = useFormatters();

  const spans = reservations.map((reservation) => {
    const start = utcToZonedParts(reservation.startsAt, format.timeZone);
    const end = utcToZonedParts(reservation.endsAt, format.timeZone);
    const startMin = start && start.date === date ? start.minutes : 0;
    const endMin = end && end.date === date ? end.minutes : 24 * 60;
    return { reservation, startMin, endMin: Math.max(endMin, startMin + 15) };
  });
  const startHour = Math.min(DEFAULT_START, ...spans.map((span) => Math.floor(span.startMin / 60)));
  const endHour = Math.max(DEFAULT_END - 1, ...spans.map((span) => Math.ceil(span.endMin / 60) - 1)) + 1;
  const totalMin = (endHour - startHour) * 60;
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);

  const rows: { id: string; label: string }[] = tables.map((table) => ({ id: table.id, label: table.number }));
  if (spans.some((span) => !span.reservation.tableId)) rows.push({ id: NO_TABLE, label: t('noTable') });

  return (
    <div className={styles.scroll}>
      <div className={styles.timeline} role="table" aria-label={t('views.day')}>
        <div className={styles.row} role="row">
          <span className={styles.label} role="columnheader">
            {t('columns.table')}
          </span>
          <div className={styles.hours} role="columnheader">
            {hours.map((hour) => (
              <span key={hour} className={styles.hour}>
                {String(hour % 24).padStart(2, '0')}
              </span>
            ))}
          </div>
        </div>
        {rows.map((row) => (
          <div key={row.id} className={styles.row} role="row">
            <span className={styles.label} role="rowheader">
              {row.label}
            </span>
            <div className={styles.track} role="cell" style={{ backgroundSize: `${100 / hours.length}% 100%` }}>
              {spans
                .filter((span) => (span.reservation.tableId ?? NO_TABLE) === row.id)
                .map(({ reservation, startMin, endMin }) => (
                  <button
                    key={reservation.id}
                    type="button"
                    className={clsx(
                      styles.block,
                      styles[reservation.status],
                      highlightIds?.has(reservation.id) && styles.conflict,
                    )}
                    style={{
                      left: `${((startMin - startHour * 60) / totalMin) * 100}%`,
                      width: `${((endMin - startMin) / totalMin) * 100}%`,
                    }}
                    onClick={() => onSelect(reservation)}
                    title={`${format.time(reservation.startsAt)}–${format.time(reservation.endsAt)} · ${reservation.guestName}`}
                  >
                    <span className={styles.blockName}>{reservation.guestName}</span>
                    <span className={styles.blockMeta}>
                      <Users aria-hidden="true" />
                      {reservation.guestCount} · {t(`status:reservation.${reservation.status}`)}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
