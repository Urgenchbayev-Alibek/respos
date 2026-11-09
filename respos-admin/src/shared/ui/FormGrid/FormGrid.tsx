import clsx from 'clsx';
import type { FormHTMLAttributes, ReactNode } from 'react';
import styles from './FormGrid.module.css';

export interface FormGridProps extends FormHTMLAttributes<HTMLFormElement> {
  columns?: 1 | 2;
  children: ReactNode;
}

/** `<form>` with consistent field spacing; 2 columns collapse to 1 on mobile. Use `data-span="full"` on wide fields. */
export function FormGrid({ columns = 1, className, children, ...rest }: FormGridProps) {
  return (
    <form noValidate className={clsx(styles.grid, columns === 2 && styles.two, className)} {...rest}>
      {children}
    </form>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}
