import { Plus, Settings2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomers } from '@/entities/customer/customer.queries';
import { CUSTOMER_SEGMENTS, type CustomerListItemDto, type CustomerSegment } from '@/entities/customer/customer.types';
import { CustomerBadges } from '@/features/customers/ui/CustomerBadges';
import { CustomerFormModal, type CustomerFormTarget } from '@/features/customers/ui/CustomerFormModal';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { buildPath, ROUTES } from '@/shared/constants/routes';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { DEFAULT_PAGE_SIZE, toSortParam, type SortState } from '@/shared/types/pagination';
import { Button, DataTable, PageHeader, SearchInput, Tabs, Toolbar, type DataTableColumn } from '@/shared/ui';

type SegmentTab = 'all' | CustomerSegment;

/** Admin → Guests: list with search, segments (new, regular, sleeping, birthday, VIP) and stats. */
export function CustomersPage() {
  const { t } = useTranslation('customers');
  const format = useFormatters();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.customers.manage);
  const [segment, setSegment] = useState<SegmentTab>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>({ field: 'createdAt', direction: 'desc' });
  const [creating, setCreating] = useState<CustomerFormTarget | null>(null);
  const debounced = useDebouncedValue(search.trim());
  const query = useCustomers({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: toSortParam(sort),
    search: debounced || undefined,
    segment: segment === 'all' ? undefined : segment,
  });

  const columns = useMemo<DataTableColumn<CustomerListItemDto>[]>(
    () => [
      {
        key: 'name',
        header: t('fields.name'),
        sortField: 'name',
        cell: (row) => (
          <>
            {/* A real link keeps the guest card reachable by keyboard (the row click is a mouse shortcut). */}
            <Link to={buildPath(ROUTES.admin.customerDetail, { customerId: row.id })} onClick={(event) => event.stopPropagation()}>
              <strong>{row.name}</strong>
            </Link>{' '}
            <CustomerBadges isVip={row.isVip} isBirthdayToday={row.isBirthdayToday} isBirthdaySoon={row.isBirthdaySoon} />
          </>
        ),
      },
      { key: 'phone', header: t('fields.phone'), cell: (row) => row.phone },
      { key: 'visits', header: t('columns.visits'), sortField: 'visits', align: 'right', cell: (row) => row.visits },
      { key: 'spent', header: t('columns.totalSpent'), sortField: 'totalSpent', align: 'right', hideOnMobile: true, cell: (row) => format.money(row.totalSpent) },
      { key: 'avg', header: t('columns.averageCheck'), align: 'right', hideOnMobile: true, cell: (row) => format.money(row.averageCheck) },
      {
        key: 'last',
        header: t('columns.lastVisit'),
        sortField: 'lastVisitAt',
        hideOnMobile: true,
        cell: (row) => (row.lastVisitAt ? format.date(row.lastVisitAt) : '—'),
      },
      { key: 'points', header: t('columns.points'), sortField: 'points', align: 'right', cell: (row) => format.number(row.points, 0) },
    ],
    [t, format],
  );

  const changeSegment = (id: string) => {
    setSegment(id as SegmentTab);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <>
            <Button icon={<Settings2 />} onClick={() => navigate(ROUTES.admin.loyalty)}>{t('actions.loyaltySettings')}</Button>
            {canManage && (
              <Button variant="primary" icon={<Plus />} onClick={() => setCreating({ customer: null })}>{t('actions.create')}</Button>
            )}
          </>
        }
      />
      <Tabs
        ariaLabel={t('segments.label')}
        value={segment}
        onChange={changeSegment}
        items={[{ id: 'all', label: t('segments.all') }, ...CUSTOMER_SEGMENTS.map((id) => ({ id, label: t(`segments.${id}`) }))]}
      />
      <Toolbar>
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={t('search')} />
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
        sort={sort}
        onSortChange={setSort}
        onRowClick={(row) => navigate(buildPath(ROUTES.admin.customerDetail, { customerId: row.id }))}
        pagination={query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }}
      />
      <CustomerFormModal
        target={creating}
        onClose={() => setCreating(null)}
        onSaved={(customer) => navigate(buildPath(ROUTES.admin.customerDetail, { customerId: customer.id }))}
      />
    </>
  );
}
