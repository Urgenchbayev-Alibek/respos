import { FlaskConical, PlugZap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './DemoBadge.module.css';

export interface DemoBadgeProps {
  /** `demo` = demo seed data / manual provider; `not-connected` = integration stub. */
  kind?: 'demo' | 'not-connected';
  /** Optional explanation shown as tooltip. */
  title?: string;
}

/** Mandatory label for mock/demo integrations and demo data (CLAUDE.md rule 10). */
export function DemoBadge({ kind = 'demo', title }: DemoBadgeProps) {
  const { t } = useTranslation();
  const label = kind === 'demo' ? t('common:demo.demo') : t('common:demo.notConnected');
  return (
    <span className={styles.badge} title={title ?? label}>
      {kind === 'demo' ? <FlaskConical aria-hidden="true" /> : <PlugZap aria-hidden="true" />}
      {label}
    </span>
  );
}
