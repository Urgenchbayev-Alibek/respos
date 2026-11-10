import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auditDateRange, useAuditLogs } from '@/entities/audit-log/audit-log.queries';
import type { AuditLogDto } from '@/entities/audit-log/audit-log.types';
import { useUsers } from '@/entities/user/user.queries';
import { AuditLogDrawer } from '@/features/audit/ui/AuditLogDrawer';
import styles from '@/features/audit/ui/audit.module.css';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { formatEntityType } from '@/shared/lib/format-entity-type';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/shared/types/pagination';
import { Button, DataTable, IconButton, Input, PageHeader, Select, Toolbar, type DataTableColumn } from '@/shared/ui';

/** Rendered only with `users.read` (the user list endpoint requires it). */
function UserFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation('audit');
  const users = useUsers({ page: 1, pageSize: MAX_PAGE_SIZE, sort: 'fullName:asc' });
  return (
    <Select
      aria-label={t('columns.user')}
      placeholder={t('filters.allUsers')}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      options={(users.data?.items ?? []).map((user) => ({ value: user.id, label: user.fullName }))}
    />
  );
}

interface Filters {
  from: string;
  to: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
}

const EMPTY: Filters = { from: '', to: '', userId: '', action: '', entityType: '', entityId: '' };

/** Append-only audit trail (read-only). */
export function AuditLogsPage() {
  const { t } = useTranslation('audit');
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const { branch } = useCurrentBranch();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogDto | null>(null);
  const text = JSON.parse(
    useDebouncedValue(JSON.stringify({ action: filters.action.trim(), entityType: filters.entityType.trim(), entityId: filters.entityId.trim() })),
  ) as Pick<Filters, 'action' | 'entityType' | 'entityId'>;
  const query = useAuditLogs({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: 'createdAt:desc',
    ...auditDateRange(filters.from, filters.to, branch?.timezone),
    userId: filters.userId || undefined,
    action: text.action || undefined,
    entityType: text.entityType || undefined,
    entityId: text.entityId || undefined,
  });
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const columns = useMemo<DataTableColumn<AuditLogDto>[]>(
    () => [
      { key: 'time', header: t('columns.time'), cell: (row) => format.dateTime(row.createdAt) },
      { key: 'user', header: t('columns.user'), cell: (row) => row.userName ?? '—' },
      { key: 'action', header: t('columns.action'), cell: (row) => <span className={styles.mono}>{row.action}</span> },
      { key: 'entity', header: t('columns.entityType'), hideOnMobile: true, cell: (row) => formatEntityType(row.entityType) },
      { key: 'entityId', header: t('columns.entityId'), hideOnMobile: true, cell: (row) => <span className={styles.mono}>{row.entityId?.slice(0, 8) ?? '—'}</span> },
      { key: 'correlation', header: t('columns.correlationId'), hideOnMobile: true, cell: (row) => <span className={styles.mono}>{row.correlationId?.slice(0, 8) ?? '—'}</span> },
      {
        key: 'open',
        header: <span className="visually-hidden">{t('details')}</span>,
        align: 'right',
        width: '56px',
        cell: (row) => <IconButton label={t('openDetails', { action: row.action })} icon={<ChevronRight />} onClick={(event) => { event.stopPropagation(); setSelected(row); }} />,
      },
    ],
    [t, format],
  );

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <Toolbar
        actions={Object.values(filters).some(Boolean) && <Button variant="ghost" onClick={() => { setFilters(EMPTY); setPage(1); }}>{t('reset')}</Button>}
      >
        <Input type="date" aria-label={t('filters.from')} value={filters.from} onChange={(event) => update('from', event.target.value)} />
        <Input type="date" aria-label={t('filters.to')} value={filters.to} onChange={(event) => update('to', event.target.value)} />
        {hasPermission(PERMISSIONS.users.read) && (
          <UserFilter value={filters.userId} onChange={(value) => update('userId', value)} />
        )}
        <Input aria-label={t('columns.action')} placeholder={t('filters.action')} value={filters.action} onChange={(event) => update('action', event.target.value)} />
        <Input aria-label={t('columns.entityType')} placeholder={t('filters.entityType')} value={filters.entityType} onChange={(event) => update('entityType', event.target.value)} />
        <Input aria-label={t('columns.entityId')} placeholder={t('filters.entityId')} value={filters.entityId} onChange={(event) => update('entityId', event.target.value)} />
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
        onRowClick={setSelected}
        pagination={query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }}
      />
      <AuditLogDrawer entry={selected} onClose={() => setSelected(null)} />
    </>
  );
}
