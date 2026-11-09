import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { ACTIVE_ORDER_STATUSES } from '@/entities/order/order.types';
import { ORDER_STATUSES, type OrderStatus } from '@/shared/constants/statuses';
import styles from './OrderStatusChips.module.css';

export interface OrderStatusChipsProps {
  value: readonly OrderStatus[];
  onChange: (value: OrderStatus[]) => void;
}

/** Multi-select status filter (toggle chips) with "Active" and "All" presets. */
export function OrderStatusChips({ value, onChange }: OrderStatusChipsProps) {
  const { t } = useTranslation('orders');
  const isActivePreset =
    value.length === ACTIVE_ORDER_STATUSES.length && ACTIVE_ORDER_STATUSES.every((status) => value.includes(status));
  const toggle = (status: OrderStatus) =>
    onChange(value.includes(status) ? value.filter((current) => current !== status) : [...value, status]);

  return (
    <div className={styles.chips} role="group" aria-label={t('filters.status')}>
      <button
        type="button"
        className={clsx(styles.chip, value.length === 0 && styles.on)}
        aria-pressed={value.length === 0}
        onClick={() => onChange([])}
      >
        {t('filters.all')}
      </button>
      <button
        type="button"
        className={clsx(styles.chip, isActivePreset && styles.on)}
        aria-pressed={isActivePreset}
        onClick={() => onChange([...ACTIVE_ORDER_STATUSES])}
      >
        {t('filters.active')}
      </button>
      <span className={styles.divider} aria-hidden="true" />
      {ORDER_STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          className={clsx(styles.chip, value.includes(status) && styles.on)}
          aria-pressed={value.includes(status)}
          onClick={() => toggle(status)}
        >
          {t(`status:order.${status}`)}
        </button>
      ))}
    </div>
  );
}
