import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useRealtimeStatus } from '@/shared/realtime';
import styles from './TopbarTrigger.module.css';

/** Realtime connection indicator (important for KDS / waiter screens). */
export function ConnectionStatus({ showLabel = true }: { showLabel?: boolean }) {
  const { t } = useTranslation();
  const state = useRealtimeStatus();
  const label = t(`nav:realtime.${state}`);
  return (
    <span className={styles.status} role="status" title={label}>
      <span className={clsx(styles.dot, styles[state])} aria-hidden="true" />
      <span className={showLabel ? styles.statusLabel : 'visually-hidden'}>{label}</span>
    </span>
  );
}
