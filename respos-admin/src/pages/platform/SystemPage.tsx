import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSystemEvents, useSystemStatus } from '@/entities/platform/platform.queries';
import type { SystemEventDto } from '@/entities/platform/platform.types';
import styles from '@/features/platform/ui/platform.module.css';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { DEFAULT_PAGE_SIZE } from '@/shared/types/pagination';
import { Card, DataTable, ErrorState, PageHeader, StatCard, StatusBadge, type DataTableColumn } from '@/shared/ui';

const HEALTHY = ['healthy', 'ok', 'up', 'connected'];

/** Health/version/aggregates + platform system events (audit + integration errors). */
export function SystemPage() {
  const { t } = useTranslation('platform');
  const format = useFormatters();
  const [page, setPage] = useState(1);
  const status = useSystemStatus();
  const events = useSystemEvents({ page, pageSize: DEFAULT_PAGE_SIZE, sort: 'createdAt:desc' });
  const data = status.data;
  const dbOk = data ? HEALTHY.includes(data.dbStatus.toLowerCase()) : false;

  const columns: DataTableColumn<SystemEventDto>[] = [
    { key: 'time', header: t('columns.time'), cell: (row) => format.dateTime(row.createdAt) },
    { key: 'action', header: t('columns.action'), cell: (row) => <span className={styles.mono}>{row.action}</span> },
    { key: 'org', header: t('columns.organization'), hideOnMobile: true, cell: (row) => row.organizationName ?? '—' },
    { key: 'user', header: t('columns.user'), hideOnMobile: true, cell: (row) => row.userName ?? '—' },
    { key: 'entity', header: t('columns.entity'), hideOnMobile: true, cell: (row) => [row.entityType, row.entityId?.slice(0, 8)].filter(Boolean).join(' ') || '—' },
    { key: 'correlation', header: t('columns.correlationId'), hideOnMobile: true, cell: (row) => <span className={styles.mono}>{row.correlationId?.slice(0, 8) ?? '—'}</span> },
  ];

  return (
    <>
      <PageHeader title={t('system.title')} description={t('system.subtitle')} />
      {status.error && !data ? (
        <ErrorState error={status.error} onRetry={() => void status.refetch()} />
      ) : (
        <div className={styles.stats}>
          <StatCard
            label={t('system.db')}
            loading={!data}
            tone={data ? (dbOk ? 'success' : 'danger') : 'default'}
            value={data && <StatusBadge tone={dbOk ? 'success' : 'danger'}>{data.dbStatus}</StatusBadge>}
          />
          <StatCard label={t('system.version')} loading={!data} value={data?.version} hint={data?.environment} />
          <StatCard label={t('system.uptime')} loading={!data} value={data ? String(data.uptime) : null} />
          <StatCard label={t('system.organizations')} loading={!data} value={data?.organizationsCount} />
          <StatCard label={t('system.users')} loading={!data} value={data?.usersCount} />
          <StatCard label={t('system.ordersToday')} loading={!data} value={data?.ordersToday} />
        </div>
      )}
      <Card title={t('system.events')} flush>
        <DataTable
          caption={t('system.events')}
          columns={columns}
          rows={events.data?.items}
          getRowId={(row) => row.id}
          isLoading={events.isFetching}
          error={events.error}
          onRetry={() => void events.refetch()}
          emptyTitle={t('system.noEvents')}
          pagination={events.data && { page, pageSize: events.data.pageSize, totalCount: events.data.totalCount, onPageChange: setPage }}
        />
      </Card>
    </>
  );
}
