import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../IconButton/IconButton';
import styles from './Pagination.module.css';

export interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

/** Server pagination (1-based page). */
export function Pagination({ page, pageSize, totalCount, onPageChange, disabled }: PaginationProps) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(totalCount, page * pageSize);

  return (
    <nav className={styles.pagination} aria-label={t('common:pagination.label')}>
      <span className={styles.summary}>{t('common:pagination.summary', { from, to, total: totalCount })}</span>
      <div className={styles.controls}>
        <IconButton
          label={t('common:pagination.previous')}
          icon={<ChevronLeft />}
          variant="secondary"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <span className={styles.page} aria-current="page">
          {t('common:pagination.pageOf', { page, pages })}
        </span>
        <IconButton
          label={t('common:pagination.next')}
          icon={<ChevronRight />}
          variant="secondary"
          disabled={disabled || page >= pages}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </nav>
  );
}
