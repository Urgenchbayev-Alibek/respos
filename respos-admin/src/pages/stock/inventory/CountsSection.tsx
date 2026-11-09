import { ClipboardPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateCount, useStockCounts } from '@/entities/stock/stock.queries';
import type { InventoryCountDto } from '@/entities/stock/stock.types';
import { CountEditorModal } from '@/features/stock/ui/CountEditorModal';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { DEFAULT_PAGE_SIZE } from '@/shared/types/pagination';
import { Button, DataTable, StatusBadge, Toolbar, useToast, type DataTableColumn } from '@/shared/ui';

/** Inventory counts: create (snapshot of expected qty) → fill counted → complete. */
export function CountsSection() {
  const { t } = useTranslation('stock');
  const toast = useToast();
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const query = useStockCounts({ page, pageSize: DEFAULT_PAGE_SIZE, sort: 'createdAt:desc' });
  const create = useCreateCount();

  const start = async () => {
    try {
      const count = await create.mutateAsync();
      setOpenId(count.id);
    } catch (error) {
      toast.error(t('counts.createFailed'), getErrorMessage(error, t));
    }
  };

  const columns = useMemo<DataTableColumn<InventoryCountDto>[]>(
    () => [
      { key: 'number', header: t('columns.number'), cell: (row) => row.number ?? row.id.slice(0, 8) },
      { key: 'created', header: t('columns.date'), cell: (row) => format.dateTime(row.createdAt) },
      { key: 'status', header: t('columns.status'), cell: (row) => <StatusBadge domain="inventoryCount" status={row.status} /> },
      { key: 'completed', header: t('columns.completedAt'), hideOnMobile: true, cell: (row) => format.dateTime(row.completedAt) },
      { key: 'user', header: t('columns.user'), hideOnMobile: true, cell: (row) => row.createdByName ?? '—' },
      {
        key: 'open',
        header: <span className="visually-hidden">{t('columns.actions')}</span>,
        align: 'right',
        cell: (row) => (
          <Button size="sm" variant="ghost" onClick={() => setOpenId(row.id)}>
            {row.status === 'draft' ? t('counts.continue') : t('counts.view')}
          </Button>
        ),
      },
    ],
    [t, format],
  );

  return (
    <>
      <Toolbar
        actions={
          hasPermission(PERMISSIONS.inventory.adjust) && (
            <Button variant="primary" icon={<ClipboardPlus />} loading={create.isPending} onClick={() => void start()}>
              {t('counts.create')}
            </Button>
          )
        }
      >
        <p>{t('counts.description')}</p>
      </Toolbar>
      <DataTable
        caption={t('tabs.counts')}
        columns={columns}
        rows={query.data?.items}
        getRowId={(row) => row.id}
        isLoading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('counts.empty')}
        onRowClick={(row) => setOpenId(row.id)}
        pagination={query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }}
      />
      <CountEditorModal countId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
