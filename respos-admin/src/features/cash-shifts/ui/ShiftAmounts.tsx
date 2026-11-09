import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './ShiftAmounts.module.css';

export interface AmountRow {
  label: ReactNode;
  value: ReactNode;
  tone?: 'positive' | 'negative' | 'strong';
  testId?: string;
}

/** Label/value list for shift totals (definition list → readable by screen readers). */
export function ShiftAmounts({ rows }: { rows: AmountRow[] }) {
  return (
    <dl className={styles.list}>
      {rows.map((row, index) => (
        <div key={index} className={clsx(styles.row, row.tone && styles[row.tone])} data-testid={row.testId}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
