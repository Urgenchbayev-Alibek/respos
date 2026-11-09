import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './Toolbar.module.css';

export interface ToolbarProps {
  /** Filters (SearchInput, Select…) on the left; wraps on small screens. */
  children: ReactNode;
  /** Actions on the right (e.g. "Reset filters", export). */
  actions?: ReactNode;
  className?: string;
}

/** Filter bar above lists. */
export function Toolbar({ children, actions, className }: ToolbarProps) {
  return (
    <div className={clsx(styles.toolbar, className)} role="search">
      <div className={styles.filters}>{children}</div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
