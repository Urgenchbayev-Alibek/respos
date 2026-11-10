import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIntegrationErrors } from '@/entities/integration/integration.queries';
import type { IntegrationErrorDto } from '@/entities/integration/integration.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { DEFAULT_PAGE_SIZE } from '@/shared/types/pagination';
import { DataTable, type DataTableColumn } from '@/shared/ui';

/** Integration error log: own organization, or all organizations for the platform admin. */
export function IntegrationErrorsTable({ scope }: { scope: 'organization' | 'platform' }) {
  const { t } = useTranslation('integrations');
  const format = useFormatters();
  const [page, setPage] = useState(1);
  const query = useIntegrationErrors({ page, pageSize: DEFAULT_PAGE_SIZE }, scope);

  const columns = useMemo<DataTableColumn<IntegrationErrorDto>[]>(() => {
    const list: DataTableColumn<IntegrationErrorDto>[] = [
      { key: 'createdAt', header: t('columns.createdAt'), cell: (row) => format.dateTime(row.createdAt) },
      {
        key: 'integration',
        header: t('columns.integration'),
        cell: (row) => (row.integrationType ? t(`types.${row.integrationType}.title`) : row.channel ?? '—'),
      },
      { key: 'operation', header: t('columns.kind'), cell: (row) => t(`kinds.${row.operation}`, { defaultValue: row.operation }) },
      { key: 'message', header: t('columns.message'), cell: (row) => row.message },
    ];
    if (scope === 'platform') {
      list.splice(1, 0, { key: 'organization', header: t('columns.organization'), cell: (row) => row.organizationName ?? '—' });
    }
    return list;
  }, [t, format, scope]);

  return (
    <DataTable
      caption={t('errors.title')}
      columns={columns}
      rows={query.data?.items}
      getRowId={(row) => row.id}
      isLoading={query.isFetching}
      error={query.error}
      onRetry={() => void query.refetch()}
      emptyTitle={t('errors.empty')}
      pagination={query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }}
    />
  );
}
