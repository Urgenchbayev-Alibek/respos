import clsx from 'clsx';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './Alert.module.css';

/** Inline message above/below a form (server error not tied to a field, or success). */
export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success'; children: ReactNode }) {
  return (
    <div className={clsx(styles.alert, styles[tone])} role={tone === 'error' ? 'alert' : 'status'}>
      {tone === 'error' ? <AlertCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
      <span>{children}</span>
    </div>
  );
}
