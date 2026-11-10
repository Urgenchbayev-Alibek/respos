import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './analytics.module.css';

export interface DeltaBadgeProps {
  /** Δ % vs the previous period; null = no base to compare. */
  value: number | null | undefined;
  /** For metrics where growth is bad (refunds, discounts, cancellations). */
  invert?: boolean;
}

/** "+12.5 %" with an arrow and colour; the text alone carries the meaning (colour is a hint). */
export function DeltaBadge({ value, invert = false }: DeltaBadgeProps) {
  const { t, i18n } = useTranslation('analytics');
  if (value === null || value === undefined) {
    return <span className={clsx(styles.delta, styles.deltaNeutral)}>{t('delta.noBase')}</span>;
  }
  const good = invert ? value < 0 : value > 0;
  const tone = value === 0 ? styles.deltaNeutral : good ? styles.deltaGood : styles.deltaBad;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  const text = `${value > 0 ? '+' : ''}${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value)} %`;
  return (
    <span className={clsx(styles.delta, tone)} title={t('delta.hint')}>
      <Icon aria-hidden="true" />
      {text}
      <span className={styles.srOnly}> {t('delta.hint')}</span>
    </span>
  );
}
