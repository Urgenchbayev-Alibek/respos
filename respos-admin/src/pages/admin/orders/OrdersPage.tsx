import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { orderKeys, useOrders } from '@/entities/order/order.queries';
import { formatOrderNumber, ORDER_TYPES, type OrderSummaryDto, type OrderType } from '@/entities/order/order.types';
import { useTables } from '@/entities/table/table.queries';
import { OrderDetailDrawer } from '@/features/orders/ui/OrderDetailDrawer';
import { OrderStatusChips } from '@/features/orders/ui/OrderStatusChips';
import { WaiterFilter } from '@/features/orders/ui/WaiterFilter';
import { PERMISSIONS } from '@/shared/constants/permissions';
import type { OrderStatus } from '@/shared/constants/statuses';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { dateRangeToUtc } from '@/shared/lib/zoned-time';
import { useRealtimeEvent } from '@/shared/realtime';
import { DEFAULT_PAGE_SIZE, toSortParam, type SortState } from '@/shared/types/pagination';
import { DataTable, Input, PageHeader, SearchInput, Select, StatusBadge, Toolbar, type DataTableColumn } from '@/shared/ui';

interface Filters {
  statuses: OrderStatus[];
  type: OrderType | '';
  tableId: string;
  waiterId: string;
  from: string;
  to: string;
  search: string;
}

const EMPTY: Filters = { statuses: [], type: '', tableId: '', waiterId: '', from: '', to: '', search: '' };

/** All orders of the branch with filters; row → details drawer (items, history, payments). */
export function OrdersPage() {
  const { t } = useTranslation('orders');
  const format = useFormatters();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>({ field: 'openedAt', direction: 'desc' });
  const [openedId, setOpenedId] = useState<string | null>(null);
  const search = useDebouncedValue(filters.search.trim());
  const tables = useTables();
  const canReadUsers = hasPermission(PERMISSIONS.users.read);
  const { branch } = useCurrentBranch();

  const query = useOrders({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: toSortParam(sort),
    status: filters.statuses.length > 0 ? filters.statuses : undefined,
    type: filters.type || undefined,
    tableId: filters.tableId || undefined,
    waiterId: filters.waiterId || undefined,
    ...dateRangeToUtc(filters.from, filters.to, branch?.timezone),
    search: search || undefined,
  });

  useRealtimeEvent('OrderUpdated', () => void queryClient.invalidateQueries({ queryKey: orderKeys.all }));

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const columns = useMemo<DataTableColumn<OrderSummaryDto>[]>(
    () => [
      {
        key: 'number',
        header: t('columns.number'),
        sortField: 'number',
        cell: (o) => <strong>{formatOrderNumber(o.number)}</strong>,
      },
      { key: 'type', header: t('columns.type'), hideOnMobile: true, cell: (o) => t(`type.${o.type}`) },
      { key: 'table', header: t('columns.table'), cell: (o) => o.tableNumber ?? '—' },
      { key: 'waiter', header: t('columns.waiter'), hideOnMobile: true, cell: (o) => o.waiterName ?? '—' },
      { key: 'status', header: t('columns.status'), cell: (o) => <StatusBadge domain="order" status={o.status} /> },
      {
        key: 'openedAt',
        header: t('columns.openedAt'),
        sortField: 'openedAt',
        hideOnMobile: true,
        cell: (o) => format.dateTime(o.openedAt),
      },
      { key: 'total', header: t('columns.total'), sortField: 'total', align: 'right', cell: (o) => format.money(o.total) },
      { key: 'paid', header: t('columns.paid'), align: 'right', hideOnMobile: true, cell: (o) => format.money(o.paidAmount) },
    ],
    [t, format],
  );

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <OrderStatusChips value={filters.statuses} onChange={(statuses) => update('statuses', statuses)} />
      <Toolbar>
        <SearchInput value={filters.search} onChange={(value) => update('search', value)} placeholder={t('searchPlaceholder')} />
        <Select
          aria-label={t('columns.type')}
          placeholder={t('filters.allTypes')}
          value={filters.type}
          onChange={(event) => update('type', event.target.value as OrderType | '')}
          options={ORDER_TYPES.map((type) => ({ value: type, label: t(`type.${type}`) }))}
        />
        <Select
          aria-label={t('columns.table')}
          placeholder={t('filters.allTables')}
          value={filters.tableId}
          onChange={(event) => update('tableId', event.target.value)}
          options={(tables.data ?? []).map((table) => ({ value: table.id, label: table.number }))}
        />
        {canReadUsers && <WaiterFilter value={filters.waiterId} onChange={(waiterId) => update('waiterId', waiterId)} />}
        <Input
          type="date"
          aria-label={t('filters.from')}
          value={filters.from}
          onChange={(event) => update('from', event.target.value)}
        />
        <Input
          type="date"
          aria-label={t('filters.to')}
          value={filters.to}
          onChange={(event) => update('to', event.target.value)}
        />
      </Toolbar>
      <DataTable
        caption={t('title')}
        columns={columns}
        rows={query.data?.items}
        getRowId={(o) => o.id}
        isLoading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('empty')}
        sort={sort}
        onSortChange={setSort}
        onRowClick={(o) => setOpenedId(o.id)}
        pagination={
          query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }
        }
      />
      {openedId && <OrderDetailDrawer orderId={openedId} onClose={() => setOpenedId(null)} />}
    </>
  );
}
