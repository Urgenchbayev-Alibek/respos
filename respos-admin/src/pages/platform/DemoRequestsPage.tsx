import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDemoRequests, useSetDemoRequestStatus } from '@/entities/platform/platform.queries';
import type { DemoRequestDto } from '@/entities/platform/platform.types';
import { DEMO_REQUEST_STATUSES, type DemoRequestStatus } from '@/shared/constants/statuses';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { DEFAULT_PAGE_SIZE } from '@/shared/types/pagination';
import { DataTable, PageHeader, Select, StatusBadge, Toolbar, useToast, type DataTableColumn } from '@/shared/ui';

/** Demo requests from the landing form; status new → contacted → closed. */
export function DemoRequestsPage() {
  const { t } = useTranslation('platform');
  const toast = useToast();
  const format = useFormatters();
  const [status, setStatus] = useState<DemoRequestStatus | ''>('');
  const [page, setPage] = useState(1);
  const query = useDemoRequests({ page, pageSize: DEFAULT_PAGE_SIZE, sort: 'createdAt:desc', status: status || undefined });
  const setRequestStatus = useSetDemoRequestStatus();

  const columns = useMemo<DataTableColumn<DemoRequestDto>[]>(() => {
    const change = async (row: DemoRequestDto, next: DemoRequestStatus) => {
      try {
        await setRequestStatus.mutateAsync({ id: row.id, status: next });
        toast.success(t('demo.statusSaved'));
      } catch (error) {
        toast.error(t('demo.statusFailed'), getErrorMessage(error, t));
      }
    };
    return [
      { key: 'date', header: t('columns.createdAt'), cell: (row) => format.dateTime(row.createdAt) },
      { key: 'restaurant', header: t('demo.restaurant'), cell: (row) => (<><strong>{row.restaurantName}</strong>{row.city && <><br /><small>{row.city}</small></>}</>) },
      { key: 'contact', header: t('demo.contact'), cell: (row) => (<>{row.name}<br /><small>{[row.phone, row.email].filter(Boolean).join(' · ')}</small></>) },
      { key: 'message', header: t('demo.message'), hideOnMobile: true, cell: (row) => row.message || '—' },
      { key: 'status', header: t('columns.status'), cell: (row) => <StatusBadge domain="demoRequest" status={row.status} /> },
      {
        key: 'change',
        header: t('demo.changeStatus'),
        cell: (row) => (
          <Select
            aria-label={t('demo.changeStatusFor', { name: row.restaurantName })}
            value={row.status}
            disabled={setRequestStatus.isPending}
            onChange={(event) => void change(row, event.target.value as DemoRequestStatus)}
            options={DEMO_REQUEST_STATUSES.map((value) => ({ value, label: t(`status:demoRequest.${value}`) }))}
          />
        ),
      },
    ];
  }, [t, format, toast, setRequestStatus]);

  return (
    <>
      <PageHeader title={t('demo.title')} description={t('demo.subtitle')} />
      <Toolbar>
        <Select
          aria-label={t('columns.status')}
          placeholder={t('filters.allStatuses')}
          value={status}
          onChange={(event) => { setStatus(event.target.value as DemoRequestStatus | ''); setPage(1); }}
          options={DEMO_REQUEST_STATUSES.map((value) => ({ value, label: t(`status:demoRequest.${value}`) }))}
        />
      </Toolbar>
      <DataTable
        caption={t('demo.title')}
        columns={columns}
        rows={query.data?.items}
        getRowId={(row) => row.id}
        isLoading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('demo.empty')}
        pagination={query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }}
      />
    </>
  );
}
