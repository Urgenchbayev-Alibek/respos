import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import styles from './Container.module.css';

interface ContainerProps {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
}

export function Container({ children, className, narrow = false }: ContainerProps) {
  return <div className={cx(styles.container, narrow && styles.narrow, className)}>{children}</div>;
}
