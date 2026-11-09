import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlatformOrganizations } from '@/entities/platform/platform.queries';
import type { PlatformOrganizationDto } from '@/entities/platform/platform.types';
import { BreakGlassDialog } from '@/features/platform/ui/BreakGlassDialog';
import { CreateOrganizationModal } from '@/features/platform/ui/CreateOrganizationModal';
import { OrganizationRowActions } from '@/features/platform/ui/OrganizationRowActions';
import styles from '@/features/platform/ui/platform.module.css';
import { SubscriptionModal } from '@/features/platform/ui/SubscriptionModal';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { ORGANIZATION_STATUSES, type OrganizationStatus } from '@/shared/constants/statuses';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { DEFAULT_PAGE_SIZE, toSortParam, type SortState } from '@/shared/types/pagination';
import { Button, DataTable, DemoBadge, PageHeader, SearchInput, Select, StatusBadge, Toolbar, type DataTableColumn } from '@/shared/ui';

/** Tenants with aggregates only (no business data). */
export function OrganizationsPage() {
  const { t } = useTranslation('platform');
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrganizationStatus | ''>('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>({ field: 'createdAt', direction: 'desc' });
  const [creating, setCreating] = useState(false);
  const [subscriptionFor, setSubscriptionFor] = useState<PlatformOrganizationDto | null>(null);
  const [accessFor, setAccessFor] = useState<PlatformOrganizationDto | null>(null);
  const debounced = useDebouncedValue(search.trim());
  const query = usePlatformOrganizations({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: toSortParam(sort),
    search: debounced || undefined,
    status: status || undefined,
  });

  const columns = useMemo<DataTableColumn<PlatformOrganizationDto>[]>(
    () => [
      {
        key: 'name',
        header: t('columns.organization'),
        sortField: 'name',
        cell: (row) => (
          <>
            <strong>{row.name}</strong> {row.isDemo && <DemoBadge />}
            <br />
            <small className={styles.mono}>{row.slug}</small>
          </>
        ),
      },
      { key: 'status', header: t('columns.status'), cell: (row) => <StatusBadge domain="organization" status={row.status} /> },
      {
        key: 'plan',
        header: t('columns.plan'),
        cell: (row) => (
          <>
            {row.planCode ?? '—'}{' '}
            {row.subscriptionStatus && <StatusBadge size="sm" domain="subscription" status={row.subscriptionStatus} />}
          </>
        ),
      },
      { key: 'branches', header: t('columns.branches'), align: 'right', hideOnMobile: true, cell: (row) => row.branchesCount },
      { key: 'users', header: t('columns.users'), align: 'right', hideOnMobile: true, cell: (row) => row.usersCount },
      { key: 'created', header: t('columns.createdAt'), sortField: 'createdAt', hideOnMobile: true, cell: (row) => format.date(row.createdAt) },
      {
        key: 'actions',
        header: <span className="visually-hidden">{t('columns.actions')}</span>,
        align: 'right',
        width: '56px',
        cell: (row) => <OrganizationRowActions organization={row} onSubscription={setSubscriptionFor} onAccess={setAccessFor} />,
      },
    ],
    [t, format],
  );

  return (
    <>
      <PageHeader
        title={t('organizations.title')}
        description={t('organizations.subtitle')}
        actions={
          hasPermission(PERMISSIONS.platform.organizationsManage) && (
            <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>{t('organizations.create')}</Button>
          )
        }
      />
      <Toolbar>
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={t('organizations.search')} />
        <Select
          aria-label={t('columns.status')}
          placeholder={t('filters.allStatuses')}
          value={status}
          onChange={(event) => { setStatus(event.target.value as OrganizationStatus | ''); setPage(1); }}
          options={ORGANIZATION_STATUSES.map((value) => ({ value, label: t(`status:organization.${value}`) }))}
        />
      </Toolbar>
      <DataTable
        caption={t('organizations.title')}
        columns={columns}
        rows={query.data?.items}
        getRowId={(row) => row.id}
        isLoading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('organizations.empty')}
        sort={sort}
        onSortChange={setSort}
        pagination={query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }}
      />
      <CreateOrganizationModal open={creating} onClose={() => setCreating(false)} />
      <SubscriptionModal organization={subscriptionFor} onClose={() => setSubscriptionFor(null)} />
      <BreakGlassDialog organization={accessFor} onClose={() => setAccessFor(null)} />
    </>
  );
}
