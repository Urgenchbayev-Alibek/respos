import { ArrowLeftRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStockTransfers } from '@/entities/stock-transfer/stock-transfer.queries';
import {
  TRANSFER_STATUSES,
  TRANSFER_STATUS_TONES,
  type StockTransferDto,
  type TransferDirection,
  type TransferStatus,
} from '@/entities/stock-transfer/stock-transfer.types';
import { TransferDetailDrawer } from '@/features/stock-transfers/ui/TransferDetailDrawer';
import { TransferFormModal } from '@/features/stock-transfers/ui/TransferFormModal';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { DEFAULT_PAGE_SIZE } from '@/shared/types/pagination';
import { Button, DataTable, Select, StatusBadge, Toolbar, type DataTableColumn } from '@/shared/ui';

/** Stock transfers of the current branch: outgoing (any status) and incoming (sent or later). */
export function TransfersSection() {
  const { t } = useTranslation('transfers');
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TransferStatus | ''>('');
  const [direction, setDirection] = useState<TransferDirection | ''>('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const query = useStockTransfers({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    status: status || undefined,
    direction: direction || undefined,
  });

  const columns = useMemo<DataTableColumn<StockTransferDto>[]>(
    () => [
      {
        key: 'number',
        header: t('columns.number'),
        cell: (row) => <strong>{row.number}</strong>,
      },
      {
        key: 'direction',
        header: t('columns.direction'),
        cell: (row) => t(`direction.${row.direction}`),
      },
      {
        key: 'route',
        header: t('columns.route'),
        cell: (row) => `${row.fromBranchName} → ${row.toBranchName}`,
      },
      {
        key: 'status',
        header: t('columns.status'),
        cell: (row) => <StatusBadge tone={TRANSFER_STATUS_TONES[row.status]}>{t(`status.${row.status}`)}</StatusBadge>,
      },
      {
        key: 'lines',
        header: t('columns.lineCount'),
        align: 'right',
        hideOnMobile: true,
        cell: (row) => format.number(row.lineCount),
      },
      {
        key: 'cost',
        header: t('columns.totalCost'),
        align: 'right',
        hideOnMobile: true,
        cell: (row) => format.money(row.totalCost),
      },
      {
        key: 'created',
        header: t('columns.createdAt'),
        hideOnMobile: true,
        cell: (row) => format.dateTime(row.createdAt),
      },
    ],
    [t, format],
  );

  return (
    <>
      <Toolbar
        actions={
          hasPermission(PERMISSIONS.inventory.transfer) && (
            <Button variant="primary" icon={<ArrowLeftRight />} onClick={() => setCreating(true)}>
              {t('actions.create')}
            </Button>
          )
        }
      >
        <Select
          aria-label={t('columns.direction')}
          placeholder={t('filters.allDirections')}
          value={direction}
          onChange={(event) => {
            setDirection(event.target.value as TransferDirection | '');
            setPage(1);
          }}
          options={(['outgoing', 'incoming'] as const).map((value) => ({
            value,
            label: t(`direction.${value}`),
          }))}
        />
        <Select
          aria-label={t('columns.status')}
          placeholder={t('filters.allStatuses')}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as TransferStatus | '');
            setPage(1);
          }}
          options={TRANSFER_STATUSES.map((value) => ({
            value,
            label: t(`status.${value}`),
          }))}
        />
      </Toolbar>
      <DataTable
        caption={t('title')}
        columns={columns}
        rows={query.data?.items}
        getRowId={(row) => row.id}
        isLoading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('empty')}
        onRowClick={(row) => setOpenId(row.id)}
        pagination={
          query.data && {
            page,
            pageSize: query.data.pageSize,
            totalCount: query.data.totalCount,
            onPageChange: setPage,
          }
        }
      />
      <TransferFormModal open={creating} onClose={() => setCreating(false)} onSaved={(saved) => setOpenId(saved.id)} />
      <TransferDetailDrawer transferId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
