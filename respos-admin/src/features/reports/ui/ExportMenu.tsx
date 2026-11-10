import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useReportExport } from '@/entities/report/analytics.queries';
import type { ExportFormat } from '@/entities/report/analytics.types';
import { PRINTABLE_REPORTS, type ReportExportName, type ReportPeriod } from '@/entities/report/report.types';
import type { QueryParams } from '@/shared/api/api-client';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Button, DropdownMenu, useToast } from '@/shared/ui';

export interface ExportMenuProps {
  name: ReportExportName;
  period?: ReportPeriod;
  params?: QueryParams;
  /** Trigger label (default «Экспорт»). */
  label?: string;
}

/**
 * CSV / Excel / PDF (print) export via the api-client. Shown only with `reports.export` (UX; the backend enforces).
 * PDF is offered for the printable reports (sales summary, Z-report) and opens the browser print dialog.
 */
export function ExportMenu({ name, period, params, label }: ExportMenuProps) {
  const { t, i18n } = useTranslation('analytics');
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const exporter = useReportExport();
  if (!hasPermission(P.reports.export)) return null;

  const run = async (format: ExportFormat) => {
    try {
      await exporter.mutateAsync({ name, format, period, params, language: i18n.language });
    } catch (error) {
      toast.error(t('export.failed'), getErrorMessage(error, t));
    }
  };
  const formats: { id: ExportFormat; icon: ReactNode }[] = [
    { id: 'csv', icon: <FileText /> },
    { id: 'xlsx', icon: <FileSpreadsheet /> },
    ...(PRINTABLE_REPORTS.includes(name) ? [{ id: 'pdf' as const, icon: <Printer /> }] : []),
  ];

  return (
    <DropdownMenu
      trigger={(props) => (
        <Button size="sm" icon={<Download />} loading={exporter.isPending} {...props}>
          {label ?? t('export.menu')}
        </Button>
      )}
      items={formats.map((format) => ({
        id: format.id,
        label: t(`export.${format.id}`),
        icon: format.icon,
        onSelect: () => void run(format.id),
      }))}
    />
  );
}
