import { Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePayments } from '@/entities/payment/payment.queries';
import type { PaymentDto, PaymentListParams } from '@/entities/payment/payment.types';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { DEFAULT_PAGE_SIZE, toSortParam, type SortState } from '@/shared/types/pagination';
import { Button, DataTable, StatusBadge, type DataTableColumn } from '@/shared/ui';
import { formatOrderNumber, getRefundable } from '../model/payment-labels';
import { RefundModal } from './RefundModal';

type Filters = Omit<PaymentListParams, 'page' | 'pageSize' | 'sort'>;

/** Paged payments list with refund action (payments.refund). Used by admin and cashier. */
export function PaymentsTable({ filters, enabled = true }: { filters: Filters; enabled?: boolean }) {
  const { t } = useTranslation('payments');
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const canRefund = hasPermission(PERMISSIONS.payments.refund);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>({ field: 'createdAt', direction: 'desc' });
  const [refunding, setRefunding] = useState<PaymentDto | null>(null);
  const filterKey = JSON.stringify(filters);

  useEffect(() => setPage(1), [filterKey]);

  const query = usePayments({ ...filters, page, pageSize: DEFAULT_PAGE_SIZE, sort: toSortParam(sort) }, { enabled });

  const columns = useMemo<DataTableColumn<PaymentDto>[]>(
    () => [
      { key: 'createdAt', header: t('columns.createdAt'), sortField: 'createdAt', cell: (p) => format.dateTime(p.createdAt) },
      { key: 'order', header: t('columns.order'), cell: (p) => formatOrderNumber(p.orderNumber) },
      { key: 'method', header: t('columns.method'), cell: (p) => t(`methods.${p.method}`) },
      { key: 'amount', header: t('columns.amount'), align: 'right', sortField: 'amount', cell: (p) => format.money(p.amount) },
      {
        key: 'refunded',
        header: t('columns.refunded'),
        align: 'right',
        hideOnMobile: true,
        cell: (p) => (p.refundedAmount > 0 ? format.money(p.refundedAmount) : '—'),
      },
      { key: 'status', header: t('columns.status'), cell: (p) => <StatusBadge domain="payment" status={p.status} /> },
      { key: 'cashier', header: t('columns.cashier'), hideOnMobile: true, cell: (p) => p.createdByName ?? '—' },
      {
        key: 'actions',
        header: <span className="visually-hidden">{t('columns.actions')}</span>,
        align: 'right',
        cell: (p) =>
          canRefund && getRefundable(p) > 0 ? (
            <Button size="sm" variant="ghost" icon={<Undo2 />} onClick={() => setRefunding(p)}>
              {t('refund.action')}
            </Button>
          ) : null,
      },
    ],
    [t, format, canRefund],
  );

  return (
    <>
      <DataTable
        caption={t('title')}
        columns={columns}
        rows={query.data?.items}
        getRowId={(p) => p.id}
        isLoading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('empty')}
        sort={sort}
        onSortChange={setSort}
        pagination={query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }}
      />
      {refunding && <RefundModal payment={refunding} onClose={() => setRefunding(null)} />}
    </>
  );
}
