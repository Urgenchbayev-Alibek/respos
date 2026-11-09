import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import styles from './Badge.module.css';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return <span className={cx(styles.badge, styles[tone], className)}>{children}</span>;
}
