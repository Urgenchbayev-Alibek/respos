import clsx from 'clsx';
import { MapPin, Phone, Timer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAssignCourier, useChangeDeliveryStatus } from '@/entities/delivery/delivery.queries';
import {
  DELIVERY_TONES,
  telLink,
  type CourierDto,
  type DeliveryOrderDto,
  type DeliveryStatus,
} from '@/entities/delivery/delivery.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Button, ConfirmDialog, Select, StatusBadge, useToast } from '@/shared/ui';
import { minutesSince } from '../model/delivery-form';
import styles from './Delivery.module.css';

/** Minutes in one status after which the timer turns red. */
const LATE_AFTER_MINUTES = 30;

export interface DeliveryCardProps {
  delivery: DeliveryOrderDto;
  couriers: CourierDto[];
  canManage: boolean;
  now: number;
}

/** One kanban card: timer, customer (click-to-call), address, items, money, courier, next-status actions. */
export function DeliveryCard({ delivery, couriers, canManage, now }: DeliveryCardProps) {
  const { t } = useTranslation('delivery');
  const format = useFormatters();
  const toast = useToast();
  const changeStatus = useChangeDeliveryStatus();
  const assign = useAssignCourier();
  const [cancelling, setCancelling] = useState(false);
  const closed = delivery.allowedTransitions.length === 0;
  const minutes = minutesSince(delivery.statusChangedAt, now);
  const next = delivery.allowedTransitions.filter((s) => s !== 'cancelled');

  const run = async (status: DeliveryStatus, reason?: string) => {
    try {
      await changeStatus.mutateAsync({ orderId: delivery.orderId, status, reason });
      setCancelling(false);
    } catch (error) {
      toast.error(getErrorMessage(error, t));
    }
  };

  const onCourier = async (courierId: string) => {
    try {
      await assign.mutateAsync({ orderId: delivery.orderId, courierId: courierId || null });
    } catch (error) {
      toast.error(getErrorMessage(error, t));
    }
  };

  const address = [
    delivery.address,
    delivery.entrance && t('card.entrance', { value: delivery.entrance }),
    delivery.floor && t('card.floor', { value: delivery.floor }),
    delivery.apartment && t('card.apartment', { value: delivery.apartment }),
  ].filter(Boolean).join(', ');
  const courierOptions = [
    { value: '', label: t('courier.none') },
    ...couriers.filter((c) => c.isActive || c.id === delivery.courier?.id).map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <article className={styles.card} aria-label={t('card.label', { number: delivery.displayNumber })}>
      <header className={styles.cardHeader}>
        <strong>{delivery.displayNumber}</strong>
        <StatusBadge size="sm" tone={DELIVERY_TONES[delivery.status]}>{t(`status.${delivery.status}`)}</StatusBadge>
        {!closed && (
          <span className={clsx(styles.timer, minutes >= LATE_AFTER_MINUTES && styles.late)} title={t('card.inStatus')}>
            <Timer size={14} aria-hidden="true" /> {t('card.minutes', { count: minutes })}
          </span>
        )}
      </header>
      <div className={styles.customer}>
        <span>{delivery.customerName}</span>
        <a href={telLink(delivery.customerPhone)} className={styles.phone}>
          <Phone size={14} aria-hidden="true" /> {delivery.customerPhone}
        </a>
      </div>
      <p className={styles.address}>
        <MapPin size={14} aria-hidden="true" /> {address}
      </p>
      {delivery.comment && <p className={styles.comment}>{delivery.comment}</p>}
      <ul className={styles.items}>
        {delivery.items.map((item) => (
          <li key={item.id}>
            {format.number(item.quantity)} × {item.name}
            {item.variantName ? ` (${item.variantName})` : ''}
          </li>
        ))}
      </ul>
      <dl className={styles.money}>
        <dt>{t('card.fee')}</dt>
        <dd>{format.money(delivery.deliveryFee)}</dd>
        <dt>{t('card.total')}</dt>
        <dd><strong>{format.money(delivery.total)}</strong></dd>
        {delivery.remainingAmount > 0 && delivery.paidAmount > 0 && (
          <>
            <dt>{t('card.remaining')}</dt>
            <dd>{format.money(delivery.remainingAmount)}</dd>
          </>
        )}
      </dl>
      {delivery.paidAmount >= delivery.total && delivery.total > 0 && <StatusBadge size="sm" tone="success">{t('card.paid')}</StatusBadge>}
      {canManage && !closed ? (
        <Select
          aria-label={t('fields.courier')}
          options={courierOptions}
          value={delivery.courier?.id ?? ''}
          disabled={assign.isPending}
          onChange={(event) => void onCourier(event.target.value)}
        />
      ) : (
        delivery.courier && (
          <p className={styles.courier}>
            {t('fields.courier')}: {delivery.courier.name}{' '}
            <a href={telLink(delivery.courier.phone)}>{delivery.courier.phone}</a>
          </p>
        )
      )}
      {delivery.cancelReason && <p className={styles.comment}>{t('card.cancelReason', { reason: delivery.cancelReason })}</p>}
      {canManage && !closed && (
        <div className={styles.actions}>
          {next.map((status) => (
            <Button key={status} size="sm" variant="primary" loading={changeStatus.isPending} onClick={() => void run(status)}>
              {t(`actions.${status}`)}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setCancelling(true)}>
            {t('actions.cancelled')}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={cancelling}
        danger
        withReason
        reasonRequired
        title={t('cancel.title', { number: delivery.displayNumber })}
        message={t('cancel.message')}
        reasonLabel={t('cancel.reason')}
        confirmLabel={t('actions.cancelled')}
        loading={changeStatus.isPending}
        onConfirm={(reason) => void run('cancelled', reason)}
        onCancel={() => setCancelling(false)}
      />
    </article>
  );
}
