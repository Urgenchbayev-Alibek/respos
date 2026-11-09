import { useTranslation } from 'react-i18next';
import type { ReservationDto } from '@/entities/reservation/reservation.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Drawer, StatusBadge } from '@/shared/ui';
import { ReservationActions } from './ReservationActions';
import styles from './ReservationDrawer.module.css';

export interface ReservationDrawerProps {
  reservation: ReservationDto;
  tableLabel: string;
  onEdit: (reservation: ReservationDto) => void;
  onClose: () => void;
}

export function ReservationDrawer({ reservation, tableLabel, onEdit, onClose }: ReservationDrawerProps) {
  const { t } = useTranslation('reservations');
  const format = useFormatters();
  const rows: [string, string][] = [
    [t('fields.date'), format.date(reservation.startsAt)],
    [t('columns.time'), `${format.time(reservation.startsAt)}–${format.time(reservation.endsAt)}`],
    [t('fields.guestCount'), String(reservation.guestCount)],
    [t('fields.guestPhone'), reservation.guestPhone || '—'],
    [t('fields.table'), tableLabel],
    [t('fields.comment'), reservation.comment || '—'],
  ];
  return (
    <Drawer
      open
      onClose={onClose}
      title={reservation.guestName}
      footer={
        <div className={styles.actions}>
          <ReservationActions
            reservation={reservation}
            onEdit={(target) => {
              onClose();
              onEdit(target);
            }}
            onDone={onClose}
          />
        </div>
      }
    >
      <StatusBadge domain="reservation" status={reservation.status} size="lg" />
      <dl className={styles.list}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.row}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Drawer>
  );
}
