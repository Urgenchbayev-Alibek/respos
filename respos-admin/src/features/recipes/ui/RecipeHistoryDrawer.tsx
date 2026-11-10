import { useTranslation } from 'react-i18next';
import { useRecipeHistory } from '@/entities/recipe/recipe.queries';
import type { RecipeDto } from '@/entities/recipe/recipe.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { DataTable, Drawer, StatusBadge, type DataTableColumn } from '@/shared/ui';
import { formatUnit } from '@/shared/lib/format-unit';

export interface RecipeHistoryDrawerProps {
  open: boolean;
  menuItemId: string;
  variantId: string | null;
  onClose: () => void;
}

/** All versions (old versions are kept; consumption history is never rewritten). */
export function RecipeHistoryDrawer({ open, menuItemId, variantId, onClose }: RecipeHistoryDrawerProps) {
  const { t } = useTranslation('recipes');
  const format = useFormatters();
  const history = useRecipeHistory(open ? menuItemId : null);
  const rows = (history.data ?? []).filter((recipe) => (recipe.variantId ?? null) === variantId);
  const columns: DataTableColumn<RecipeDto>[] = [
    { key: 'version', header: t('columns.version'), cell: (row) => `v${row.version}` },
    { key: 'from', header: t('columns.effectiveFrom'), cell: (row) => format.date(row.effectiveFrom) },
    {
      key: 'active',
      header: t('columns.status'),
      cell: (row) =>
        row.isActive ? <StatusBadge tone="success">{t('active')}</StatusBadge> : <StatusBadge tone="neutral">{t('inactive')}</StatusBadge>,
    },
    { key: 'lines', header: t('columns.ingredients'), cell: (row) => row.ingredients.map((line) => `${line.ingredientName} ${format.number(line.quantity)} ${formatUnit(line.unitCode)}`).join(', ') },
    { key: 'cost', header: t('estimatedCost'), align: 'right', cell: (row) => format.money(row.estimatedCost) },
  ];

  return (
    <Drawer open={open} onClose={onClose} title={t('historyTitle')} width={720}>
      <DataTable
        caption={t('historyTitle')}
        columns={columns}
        rows={history.data ? rows : undefined}
        getRowId={(row) => row.id}
        isLoading={history.isFetching}
        error={history.error}
        onRetry={() => void history.refetch()}
        emptyTitle={t('historyEmpty')}
      />
    </Drawer>
  );
}
