import { Mail, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBranches } from '@/entities/branch/branch.queries';
import { useRoles } from '@/entities/role/role.queries';
import { useUsers } from '@/entities/user/user.queries';
import type { UserDto } from '@/entities/user/user.types';
import type { UserFormMode } from '@/features/users/model/user-schemas';
import { UserFormModal } from '@/features/users/ui/UserFormModal';
import { UserRowActions } from '@/features/users/ui/UserRowActions';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { USER_STATUSES, type UserStatus } from '@/shared/constants/statuses';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { DEFAULT_PAGE_SIZE, toSortParam, type SortState } from '@/shared/types/pagination';
import { Button, DataTable, PageHeader, SearchInput, Select, StatusBadge, Toolbar, type DataTableColumn } from '@/shared/ui';
import { UsersRolesTabs } from './UsersRolesTabs';

interface Filters {
  search: string;
  status: UserStatus | '';
  roleId: string;
  branchId: string;
}

const EMPTY_FILTERS: Filters = { search: '', status: '', roleId: '', branchId: '' };

export function UsersPage() {
  const { t } = useTranslation('users');
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>({ field: 'fullName', direction: 'asc' });
  const [modal, setModal] = useState<{ mode: UserFormMode; user?: UserDto } | null>(null);
  const search = useDebouncedValue(filters.search.trim());
  const roles = useRoles();
  const branches = useBranches();

  const query = useUsers({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: toSortParam(sort),
    search: search || undefined,
    status: filters.status || undefined,
    roleId: filters.roleId || undefined,
    branchId: filters.branchId || undefined,
  });

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const columns = useMemo<DataTableColumn<UserDto>[]>(
    () => [
      {
        key: 'name',
        header: t('columns.name'),
        sortField: 'fullName',
        cell: (user) => (
          <>
            <strong>{user.fullName}</strong>
            <br />
            <small>{user.email}</small>
          </>
        ),
      },
      { key: 'roles', header: t('columns.roles'), cell: (user) => user.roles.map((role) => role.name).join(', ') || '—' },
      {
        key: 'branches',
        header: t('columns.branches'),
        hideOnMobile: true,
        cell: (user) => user.branches.map((branch) => branch.name).join(', ') || t('allBranchesOrNone'),
      },
      { key: 'status', header: t('columns.status'), cell: (user) => <StatusBadge domain="user" status={user.status} /> },
      {
        key: 'lastLogin',
        header: t('columns.lastLogin'),
        sortField: 'lastLoginAt',
        hideOnMobile: true,
        cell: (user) => format.dateTime(user.lastLoginAt),
      },
      {
        key: 'actions',
        header: <span className="visually-hidden">{t('columns.actions')}</span>,
        align: 'right',
        width: '56px',
        cell: (user) => <UserRowActions user={user} onEdit={(target) => setModal({ mode: 'edit', user: target })} />,
      },
    ],
    [t, format],
  );

  const canCreate = hasPermission(PERMISSIONS.users.create);
  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          canCreate && (
            <>
              <Button icon={<UserPlus />} onClick={() => setModal({ mode: 'create' })}>
                {t('actions.create')}
              </Button>
              <Button variant="primary" icon={<Mail />} onClick={() => setModal({ mode: 'invite' })}>
                {t('actions.invite')}
              </Button>
            </>
          )
        }
      />
      <UsersRolesTabs />
      <Toolbar>
        <SearchInput value={filters.search} onChange={(value) => updateFilter('search', value)} placeholder={t('searchPlaceholder')} />
        <Select
          aria-label={t('columns.status')}
          placeholder={t('filters.allStatuses')}
          value={filters.status}
          onChange={(event) => updateFilter('status', event.target.value as UserStatus | '')}
          options={USER_STATUSES.map((status) => ({ value: status, label: t(`status:user.${status}`) }))}
        />
        <Select
          aria-label={t('columns.roles')}
          placeholder={t('filters.allRoles')}
          value={filters.roleId}
          onChange={(event) => updateFilter('roleId', event.target.value)}
          options={(roles.data ?? []).map((role) => ({ value: role.id, label: role.name }))}
        />
        <Select
          aria-label={t('columns.branches')}
          placeholder={t('filters.allBranches')}
          value={filters.branchId}
          onChange={(event) => updateFilter('branchId', event.target.value)}
          options={(branches.data ?? []).map((branch) => ({ value: branch.id, label: branch.name }))}
        />
      </Toolbar>
      <DataTable
        caption={t('title')}
        columns={columns}
        rows={query.data?.items}
        getRowId={(user) => user.id}
        isLoading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('empty')}
        sort={sort}
        onSortChange={setSort}
        pagination={
          query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }
        }
      />
      {modal && <UserFormModal open mode={modal.mode} user={modal.user} onClose={() => setModal(null)} />}
    </>
  );
}
