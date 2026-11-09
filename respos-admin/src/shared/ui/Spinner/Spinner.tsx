import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label; omit for decorative spinners inside buttons. */
  label?: string;
  className?: string;
}

export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  return (
    <span
      className={clsx(styles.spinner, styles[size], className)}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

/** Centered spinner for whole pages/sections (lazy routes, session restore). */
export function PageLoader() {
  const { t } = useTranslation();
  return (
    <div className={styles.page}>
      <Spinner size="lg" label={t('common:states.loading')} />
    </div>
  );
}
