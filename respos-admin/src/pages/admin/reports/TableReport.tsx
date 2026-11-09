import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ReportExportName, ReportPeriod } from '@/entities/report/report.types';
import { ExportButton } from '@/features/reports/ui/ExportButton';
import { Card, DataTable, type DataTableColumn } from '@/shared/ui';

export interface TableReportProps<T> {
  title: string;
  exportName: ReportExportName;
  period?: ReportPeriod;
  query: UseQueryResult<T[]>;
  columns: DataTableColumn<T>[];
  getRowId: (row: T, index: number) => string;
}

/** A report shown as a table card with CSV export and loading/empty/error states. */
export function TableReport<T>({ title, exportName, period, query, columns, getRowId }: TableReportProps<T>) {
  const { t } = useTranslation('reports');
  const rows = query.data;
  const ids = new Map<T, string>((rows ?? []).map((row, index) => [row, getRowId(row, index)]));
  return (
    <Card title={title} flush actions={<ExportButton name={exportName} period={period} />}>
      <DataTable
        caption={title}
        columns={columns}
        rows={rows}
        getRowId={(row) => ids.get(row) ?? ''}
        isLoading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={period ? t('emptyPeriod') : t('empty')}
      />
    </Card>
  );
}
