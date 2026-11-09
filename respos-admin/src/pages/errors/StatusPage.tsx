import type { ReactNode } from 'react';
import styles from './StatusPage.module.css';

export interface StatusPageProps {
  code: string;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
}

/** Centered 403/404/500 block; works inside a layout or standalone. */
export function StatusPage({ code, title, description, actions }: StatusPageProps) {
  return (
    <div className={styles.page}>
      <p className={styles.code} aria-hidden="true">
        {code}
      </p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
