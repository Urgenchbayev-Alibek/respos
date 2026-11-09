import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  actions?: ReactNode;
  /** Remove body padding (tables inside cards). */
  flush?: boolean;
}

export function Card({ title, actions, flush, className, children, ...rest }: CardProps) {
  return (
    <section className={clsx(styles.card, className)} {...rest}>
      {(title || actions) && (
        <header className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={clsx(styles.body, flush && styles.flush)}>{children}</div>
    </section>
  );
}
