import clsx from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SortState } from '@/shared/types/pagination';
import { EmptyState } from '../EmptyState/EmptyState';
import { ErrorState } from '../ErrorState/ErrorState';
import { Pagination, type PaginationProps } from '../Pagination/Pagination';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './DataTable.module.css';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Server sort field; makes the header clickable. */
  sortField?: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
  /** Hide on narrow screens. */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[] | undefined;
  getRowId: (row: T) => string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  pagination?: PaginationProps;
  onRowClick?: (row: T) => void;
  caption?: string;
  skeletonRows?: number;
}

function nextSort(current: SortState | null | undefined, field: string): SortState | null {
  if (current?.field !== field) return { field, direction: 'asc' };
  return current.direction === 'asc' ? { field, direction: 'desc' } : null;
}

/** Table with server pagination/sort and loading / empty / error states. */
export function DataTable<T>(props: DataTableProps<T>) {
  const { columns, rows, getRowId, isLoading, error, onRetry, sort, onSortChange, pagination, onRowClick } = props;
  const { t } = useTranslation();
  const showSkeleton = isLoading && !rows;
  const isEmpty = !isLoading && !error && rows?.length === 0;

  const renderHeader = (column: DataTableColumn<T>) => {
    if (!column.sortField || !onSortChange) return column.header;
    const active = sort?.field === column.sortField;
    const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button type="button" className={styles.sortButton} onClick={() => onSortChange(nextSort(sort, column.sortField as string))}>
        {column.header}
        <Icon aria-hidden="true" className={clsx(styles.sortIcon, active && styles.sortActive)} />
      </button>
    );
  };

  const ariaSort = (column: DataTableColumn<T>) =>
    column.sortField && sort?.field === column.sortField ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined;

  if (error && !rows) return <ErrorState error={error} onRetry={onRetry} />;

  return (
    <div className={styles.wrapper}>
      <div className={styles.scroll}>
        <table className={styles.table} aria-busy={isLoading || undefined}>
          {props.caption && <caption className="visually-hidden">{props.caption}</caption>}
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={{ width: column.width, textAlign: column.align }}
                  aria-sort={ariaSort(column)}
                  className={clsx(column.hideOnMobile && styles.hideOnMobile)}
                >
                  {renderHeader(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {showSkeleton &&
              Array.from({ length: props.skeletonRows ?? 5 }, (_, index) => (
                <tr key={`skeleton-${index}`} data-testid="datatable-skeleton-row">
                  {columns.map((column) => (
                    <td key={column.key} className={clsx(column.hideOnMobile && styles.hideOnMobile)}>
                      <Skeleton width="70%" />
                    </td>
                  ))}
                </tr>
              ))}
            {rows?.map((row) => (
              <tr
                key={getRowId(row)}
                className={clsx(onRowClick && styles.clickable)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} style={{ textAlign: column.align }} className={clsx(column.hideOnMobile && styles.hideOnMobile)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isEmpty && (
        <EmptyState
          compact
          title={props.emptyTitle ?? t('common:states.emptyTitle')}
          description={props.emptyDescription}
          action={props.emptyAction}
        />
      )}
      {error && rows ? <ErrorState compact error={error} onRetry={onRetry} /> : null}
      {pagination && pagination.totalCount > 0 && <Pagination {...pagination} disabled={isLoading} />}
    </div>
  );
}
