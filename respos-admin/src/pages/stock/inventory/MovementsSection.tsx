import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIngredientOptions } from '@/entities/ingredient/ingredient.queries';
import { useStockMovements } from '@/entities/stock/stock.queries';
import { MOVEMENT_TYPES, type MovementType, type StockMovementDto } from '@/entities/stock/stock.types';
import styles from '@/features/stock/ui/stock.module.css';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { dateRangeToUtc } from '@/shared/lib/zoned-time';
import { DEFAULT_PAGE_SIZE } from '@/shared/types/pagination';
import { Button, DataTable, Input, Select, StatusBadge, Toolbar, type DataTableColumn } from '@/shared/ui';
import { formatUnit } from '@/shared/lib/format-unit';

interface Filters {
  ingredientId: string;
  type: MovementType | '';
  from: string;
  to: string;
}

const EMPTY: Filters = { ingredientId: '', type: '', from: '', to: '' };
const TONE: Record<MovementType, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  receipt: 'success',
  consumption: 'neutral',
  write_off: 'danger',
  adjustment: 'warning',
  inventory_count: 'info',
  transfer_in: 'success',
  transfer_out: 'danger',
};

/** Movements journal (read-only; every balance change has a row here). */
export function MovementsSection() {
  const { t } = useTranslation('stock');
  const format = useFormatters();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const ingredients = useIngredientOptions();
  const query = useStockMovements({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: 'createdAt:desc',
    ingredientId: filters.ingredientId || undefined,
    type: filters.type || undefined,
    ...dateRangeToUtc(filters.from || undefined, filters.to || undefined, format.timeZone),
  });
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const columns = useMemo<DataTableColumn<StockMovementDto>[]>(
    () => [
      { key: 'date', header: t('columns.date'), cell: (row) => format.dateTime(row.createdAt) },
      { key: 'ingredient', header: t('columns.ingredient'), cell: (row) => row.ingredientName },
      {
        key: 'type',
        header: t('columns.type'),
        cell: (row) => <StatusBadge tone={TONE[row.type] ?? 'neutral'}>{t(`movementType.${row.type}`, { defaultValue: row.type })}</StatusBadge>,
      },
      {
        key: 'quantity',
        header: t('columns.change'),
        align: 'right',
        cell: (row) => (
          <span className={row.quantity < 0 ? styles.negative : styles.num}>
            {row.quantity > 0 ? '+' : ''}
            {format.number(row.quantity)} {formatUnit(row.baseUnitCode)}
          </span>
        ),
      },
      { key: 'balance', header: t('columns.balanceAfter'), align: 'right', hideOnMobile: true, cell: (row) => <span className={styles.num}>{format.number(row.balanceAfter)}</span> },
      { key: 'source', header: t('columns.source'), hideOnMobile: true, cell: (row) => t(`sourceType.${row.sourceType}`, { defaultValue: row.sourceType }) },
      { key: 'reason', header: t('columns.reason'), hideOnMobile: true, cell: (row) => row.reason || '—' },
      { key: 'user', header: t('columns.user'), hideOnMobile: true, cell: (row) => row.createdByName ?? '—' },
    ],
    [t, format],
  );

  const hasFilters = Object.values(filters).some(Boolean);
  return (
    <>
      <Toolbar
        actions={hasFilters && <Button variant="ghost" onClick={() => { setFilters(EMPTY); setPage(1); }}>{t('filters.reset')}</Button>}
      >
        <Select
          aria-label={t('columns.ingredient')}
          placeholder={t('filters.allIngredients')}
          value={filters.ingredientId}
          onChange={(event) => update('ingredientId', event.target.value)}
          options={(ingredients.data?.items ?? []).map((item) => ({ value: item.id, label: item.name }))}
        />
        <Select
          aria-label={t('columns.type')}
          placeholder={t('filters.allTypes')}
          value={filters.type}
          onChange={(event) => update('type', event.target.value as MovementType | '')}
          options={MOVEMENT_TYPES.map((value) => ({ value, label: t(`movementType.${value}`) }))}
        />
        <Input type="date" aria-label={t('filters.from')} value={filters.from} max={filters.to || undefined} onChange={(event) => update('from', event.target.value)} />
        <Input type="date" aria-label={t('filters.to')} value={filters.to} min={filters.from || undefined} onChange={(event) => update('to', event.target.value)} />
      </Toolbar>
      <DataTable
        caption={t('tabs.movements')}
        columns={columns}
        rows={query.data?.items}
        getRowId={(row) => row.id}
        isLoading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('movements.empty')}
        pagination={query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }}
      />
    </>
  );
}
