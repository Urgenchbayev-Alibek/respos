import clsx from 'clsx';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isApiError } from '@/shared/api/api-error';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Button } from '../Button/Button';
import styles from '../EmptyState/EmptyState.module.css';

export interface ErrorStateProps {
  error?: unknown;
  title?: string;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}

/** Error block with localized server message, correlation id (for support) and retry. */
export function ErrorState({ error, title, onRetry, compact, className }: ErrorStateProps) {
  const { t } = useTranslation();
  const correlationId = isApiError(error) ? error.correlationId : undefined;
  return (
    <div className={clsx(styles.state, styles.danger, compact && styles.compact, className)} role="alert">
      <span className={styles.icon} aria-hidden="true">
        <AlertTriangle />
      </span>
      <p className={styles.title}>{title ?? t('common:states.errorTitle')}</p>
      <p className={styles.description}>{getErrorMessage(error, t)}</p>
      {correlationId && <p className={styles.meta}>{t('common:states.correlationId', { id: correlationId })}</p>}
      {onRetry && (
        <div className={styles.action}>
          <Button icon={<RotateCw />} onClick={onRetry}>
            {t('common:actions.retry')}
          </Button>
        </div>
      )}
    </div>
  );
}
