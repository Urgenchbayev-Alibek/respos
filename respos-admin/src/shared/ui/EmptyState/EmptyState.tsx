import clsx from 'clsx';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({ title, description, icon, action, compact, className }: EmptyStateProps) {
  return (
    <div className={clsx(styles.state, compact && styles.compact, className)}>
      <span className={styles.icon} aria-hidden="true">
        {icon ?? <Inbox />}
      </span>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
