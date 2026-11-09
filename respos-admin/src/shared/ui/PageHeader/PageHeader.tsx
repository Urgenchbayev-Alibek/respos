import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Primary page actions (right side). */
  actions?: ReactNode;
  /** Badges next to the title (e.g. <DemoBadge/>). */
  meta?: ReactNode;
  /** Back link / breadcrumb above the title. */
  back?: ReactNode;
}

export function PageHeader({ title, description, actions, meta, back }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        {back && <div className={styles.back}>{back}</div>}
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          {meta}
        </div>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
