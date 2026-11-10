import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCustomerLedger, useCustomerOrders } from '@/entities/customer/customer.queries';
import type { CustomerOrderDto, LoyaltyTransactionDto } from '@/entities/customer/customer.types';
import { formatOrderNumber } from '@/entities/order/order.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { DEFAULT_PAGE_SIZE } from '@/shared/types/pagination';
import { DataTable, StatusBadge, type DataTableColumn } from '@/shared/ui';

const TYPE_TONE = { earn: 'success', redeem: 'primary', expire: 'neutral', reverse: 'warning' } as const;

/** Guest's orders across all branches (newest first). */
export function CustomerOrdersTable({ customerId }: { customerId: string }) {
  const { t } = useTranslation('customers');
  const format = useFormatters();
  const [page, setPage] = useState(1);
  const query = useCustomerOrders(customerId, { page, pageSize: DEFAULT_PAGE_SIZE });
  const columns = useMemo<DataTableColumn<CustomerOrderDto>[]>(
    () => [
      { key: 'number', header: t('orders.number'), cell: (row) => <strong>{formatOrderNumber(row.number)}</strong> },
      { key: 'date', header: t('orders.openedAt'), cell: (row) => format.dateTime(row.openedAt) },
      { key: 'branch', header: t('orders.branch'), hideOnMobile: true, cell: (row) => row.branchName ?? '—' },
      { key: 'status', header: t('orders.status'), cell: (row) => <StatusBadge domain="order" status={row.status} /> },
      { key: 'points', header: t('orders.pointsUsed'), align: 'right', hideOnMobile: true, cell: (row) => format.money(row.loyaltyDiscountAmount) },
      { key: 'total', header: t('orders.total'), align: 'right', cell: (row) => format.money(row.total) },
    ],
    [t, format],
  );
  return (
    <DataTable
      caption={t('detail.orders')}
      columns={columns}
      rows={query.data?.items}
      getRowId={(row) => row.id}
      isLoading={query.isFetching}
      error={query.error}
      onRetry={() => void query.refetch()}
      emptyTitle={t('orders.empty')}
      pagination={query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }}
    />
  );
}

/** Points ledger (earn / redeem / expire / reverse) with running balance. */
export function CustomerLedgerTable({ customerId }: { customerId: string }) {
  const { t } = useTranslation('customers');
  const format = useFormatters();
  const [page, setPage] = useState(1);
  const query = useCustomerLedger(customerId, { page, pageSize: DEFAULT_PAGE_SIZE });
  const columns = useMemo<DataTableColumn<LoyaltyTransactionDto>[]>(
    () => [
      { key: 'date', header: t('ledger.date'), cell: (row) => format.dateTime(row.createdAt) },
      { key: 'type', header: t('ledger.type'), cell: (row) => <StatusBadge tone={TYPE_TONE[row.type]}>{t(`ledger.types.${row.type}`)}</StatusBadge> },
      { key: 'reason', header: t('ledger.reason'), hideOnMobile: true, cell: (row) => t(`ledger.reasons.${row.reason}`) },
      { key: 'order', header: t('ledger.order'), hideOnMobile: true, cell: (row) => (row.orderNumber ? formatOrderNumber(row.orderNumber) : '—') },
      {
        key: 'points',
        header: t('ledger.points'),
        align: 'right',
        cell: (row) => `${row.points > 0 ? '+' : ''}${format.number(row.points, 0)}`,
      },
      { key: 'balance', header: t('ledger.balance'), align: 'right', cell: (row) => format.number(row.balanceAfter, 0) },
      {
        key: 'expires',
        header: t('ledger.expiresAt'),
        hideOnMobile: true,
        cell: (row) => (row.expiresAt ? format.date(row.expiresAt) : '—'),
      },
    ],
    [t, format],
  );
  return (
    <DataTable
      caption={t('detail.ledger')}
      columns={columns}
      rows={query.data?.items}
      getRowId={(row) => row.id}
      isLoading={query.isFetching}
      error={query.error}
      onRetry={() => void query.refetch()}
      emptyTitle={t('ledger.empty')}
      pagination={query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }}
    />
  );
}
