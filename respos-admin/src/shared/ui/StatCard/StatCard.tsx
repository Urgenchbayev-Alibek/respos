import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './StatCard.module.css';

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}

export function StatCard({ label, value, hint, icon, loading, tone = 'default' }: StatCardProps) {
  return (
    <div className={clsx(styles.card, styles[tone])}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <div className={styles.value}>{loading ? <Skeleton width="60%" height={28} /> : value}</div>
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}
