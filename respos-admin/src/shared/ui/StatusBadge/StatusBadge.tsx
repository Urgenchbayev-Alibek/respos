import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getStatusTone, type StatusDomain, type StatusTone } from '@/shared/constants/statuses';
import styles from './StatusBadge.module.css';

export interface StatusBadgeProps {
  /** Domain status: label from i18n `status:<domain>.<status>`, colour from STATUS_TONES. */
  domain?: StatusDomain;
  status?: string;
  /** Or a free badge: explicit tone + children. */
  tone?: StatusTone;
  children?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusBadge({ domain, status, tone, children, size = 'md', className }: StatusBadgeProps) {
  const { t } = useTranslation();
  const resolvedTone = tone ?? (domain && status ? getStatusTone(domain, status) : 'neutral');
  const label = children ?? (domain && status ? t(`status:${domain}.${status}`, { defaultValue: status }) : null);
  return (
    <span className={clsx(styles.badge, styles[resolvedTone], styles[size], className)}>
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </span>
  );
}
