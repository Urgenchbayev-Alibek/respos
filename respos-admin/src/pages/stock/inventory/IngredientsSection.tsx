import { ArrowLeftRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIngredientCategories, useIngredients } from '@/entities/ingredient/ingredient.queries';
import type { IngredientDto } from '@/entities/ingredient/ingredient.types';
import { IngredientFormModal } from '@/features/stock/ui/IngredientFormModal';
import { IngredientRowActions } from '@/features/stock/ui/IngredientRowActions';
import { MinQuantityModal } from '@/features/stock/ui/MinQuantityModal';
import { StockMovementModal } from '@/features/stock/ui/StockMovementModal';
import { IngredientStockBadge, QuantityCell } from '@/features/stock/ui/StockLevel';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { DEFAULT_PAGE_SIZE, toSortParam, type SortState } from '@/shared/types/pagination';
import { Button, Checkbox, DataTable, SearchInput, Select, Toolbar, type DataTableColumn } from '@/shared/ui';
import { formatUnit } from '@/shared/lib/format-unit';

interface Filters {
  search: string;
  categoryId: string;
  lowStock: boolean;
}

const EMPTY: Filters = { search: '', categoryId: '', lowStock: false };

/** Ingredient balances of the current branch: filters, low-stock highlight, row actions. */
export function IngredientsSection() {
  const { t } = useTranslation('stock');
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>({ field: 'name', direction: 'asc' });
  const [movementFor, setMovementFor] = useState<{ ingredient: IngredientDto | null } | null>(null);
  const [minFor, setMinFor] = useState<IngredientDto | null>(null);
  const [formFor, setFormFor] = useState<{ ingredient: IngredientDto | null } | null>(null);
  const search = useDebouncedValue(filters.search.trim());
  const categories = useIngredientCategories();
  const query = useIngredients({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: toSortParam(sort),
    search: search || undefined,
    categoryId: filters.categoryId || undefined,
    lowStock: filters.lowStock || undefined,
  });

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const hasFilters = filters.search !== '' || filters.categoryId !== '' || filters.lowStock;

  const columns = useMemo<DataTableColumn<IngredientDto>[]>(
    () => [
      {
        key: 'name',
        header: t('columns.ingredient'),
        sortField: 'name',
        cell: (row) => (
          <>
            <strong>{row.name}</strong>
            {row.sku && <><br /><small>{row.sku}</small></>}
          </>
        ),
      },
      { key: 'category', header: t('columns.category'), hideOnMobile: true, cell: (row) => row.categoryName ?? '—' },
      { key: 'quantity', header: t('columns.quantity'), align: 'right', sortField: 'quantity', cell: (row) => <QuantityCell ingredient={row} /> },
      {
        key: 'min',
        header: t('columns.minQuantity'),
        align: 'right',
        hideOnMobile: true,
        cell: (row) => (row.minQuantity ? `${format.number(row.minQuantity)} ${formatUnit(row.baseUnitCode)}` : '—'),
      },
      { key: 'cost', header: t('columns.costPrice'), align: 'right', hideOnMobile: true, cell: (row) => format.money(row.costPrice) },
      { key: 'status', header: t('columns.status'), cell: (row) => <IngredientStockBadge ingredient={row} /> },
      {
        key: 'actions',
        header: <span className="visually-hidden">{t('columns.actions')}</span>,
        align: 'right',
        width: '56px',
        cell: (row) => (
          <IngredientRowActions
            ingredient={row}
            onMovement={(ingredient) => setMovementFor({ ingredient })}
            onMinQuantity={setMinFor}
            onEdit={(ingredient) => setFormFor({ ingredient })}
          />
        ),
      },
    ],
    [t, format],
  );

  return (
    <>
      <Toolbar
        actions={
          <>
            {hasPermission(PERMISSIONS.inventory.adjust) && (
              <Button icon={<ArrowLeftRight />} onClick={() => setMovementFor({ ingredient: null })}>
                {t('actions.newMovement')}
              </Button>
            )}
            {hasPermission(PERMISSIONS.inventory.manage) && (
              <Button variant="primary" icon={<Plus />} onClick={() => setFormFor({ ingredient: null })}>
                {t('actions.addIngredient')}
              </Button>
            )}
          </>
        }
      >
        <SearchInput value={filters.search} onChange={(value) => update('search', value)} placeholder={t('ingredients.search')} />
        <Select
          aria-label={t('columns.category')}
          placeholder={t('filters.allCategories')}
          value={filters.categoryId}
          onChange={(event) => update('categoryId', event.target.value)}
          options={(categories.data ?? []).map((category) => ({ value: category.id, label: category.name }))}
        />
        <Checkbox label={t('filters.lowOnly')} checked={filters.lowStock} onChange={(event) => update('lowStock', event.target.checked)} />
        {hasFilters && (
          <Button variant="ghost" onClick={() => { setFilters(EMPTY); setPage(1); }}>
            {t('filters.reset')}
          </Button>
        )}
      </Toolbar>
      <DataTable
        caption={t('ingredients.title')}
        columns={columns}
        rows={query.data?.items}
        getRowId={(row) => row.id}
        isLoading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={hasFilters ? t('ingredients.emptyFiltered') : t('ingredients.empty')}
        sort={sort}
        onSortChange={setSort}
        pagination={query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }}
      />
      <StockMovementModal open={movementFor !== null} ingredient={movementFor?.ingredient} onClose={() => setMovementFor(null)} />
      <MinQuantityModal ingredient={minFor} onClose={() => setMinFor(null)} />
      <IngredientFormModal open={formFor !== null} ingredient={formFor?.ingredient} onClose={() => setFormFor(null)} />
    </>
  );
}
