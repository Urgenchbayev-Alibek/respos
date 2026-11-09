import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReservationDto } from '@/entities/reservation/reservation.types';
import { ReservationActions } from '@/features/reservations/ui/ReservationActions';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { DataTable, StatusBadge, type DataTableColumn } from '@/shared/ui';
import type { PaginationProps } from '@/shared/ui/Pagination/Pagination';
import styles from './ReservationsPage.module.css';

export interface ReservationsListProps {
  rows: ReservationDto[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  tableLabel: (reservation: ReservationDto) => string;
  highlightIds: ReadonlySet<string>;
  onOpen: (reservation: ReservationDto) => void;
  onEdit: (reservation: ReservationDto) => void;
  pagination?: PaginationProps;
}

const OVERDUE_STATUSES = new Set(['pending', 'confirmed']);

export function ReservationsList(props: ReservationsListProps) {
  const { rows, isLoading, error, onRetry, tableLabel, highlightIds, onOpen, onEdit, pagination } = props;
  const { t } = useTranslation('reservations');
  const format = useFormatters();

  const columns = useMemo<DataTableColumn<ReservationDto>[]>(
    () => [
      {
        key: 'time',
        header: t('columns.time'),
        cell: (r) => (
          <span className={highlightIds.has(r.id) ? styles.conflictCell : undefined}>
            {format.time(r.startsAt)}–{format.time(r.endsAt)}
            {highlightIds.has(r.id) && <small className={styles.conflictNote}> · {t('conflictBadge')}</small>}
          </span>
        ),
      },
      {
        key: 'guest',
        header: t('columns.guest'),
        cell: (r) => (
          <>
            <strong>{r.guestName}</strong>
            {r.guestPhone && (
              <>
                <br />
                <small>{r.guestPhone}</small>
              </>
            )}
          </>
        ),
      },
      { key: 'count', header: t('columns.guests'), cell: (r) => r.guestCount, align: 'right' },
      { key: 'table', header: t('columns.table'), cell: tableLabel },
      {
        key: 'status',
        header: t('columns.status'),
        cell: (r) => (
          <>
            <StatusBadge domain="reservation" status={r.status} />
            {OVERDUE_STATUSES.has(r.status) && Date.parse(r.endsAt) < Date.now() && (
              <small className={styles.overdue}>{t('overdueHint')}</small>
            )}
          </>
        ),
      },
      { key: 'comment', header: t('columns.comment'), hideOnMobile: true, cell: (r) => r.comment || '—' },
      {
        key: 'actions',
        header: <span className="visually-hidden">{t('columns.actions')}</span>,
        align: 'right',
        width: '56px',
        cell: (r) => <ReservationActions reservation={r} variant="menu" onEdit={onEdit} />,
      },
    ],
    [t, format, tableLabel, highlightIds, onEdit],
  );

  return (
    <DataTable
      caption={t('views.list')}
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      onRowClick={onOpen}
      emptyTitle={t('empty')}
      pagination={pagination}
    />
  );
}
