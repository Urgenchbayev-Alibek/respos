import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useExportReport } from '@/entities/report/report.queries';
import type { ReportExportName, ReportPeriod } from '@/entities/report/report.types';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Button, useToast } from '@/shared/ui';

/** CSV export via the api-client (Authorization + X-Branch-Id apply), saved as a file. */
export function ExportButton({ name, period }: { name: ReportExportName; period?: ReportPeriod }) {
  const { t } = useTranslation('reports');
  const toast = useToast();
  const exporter = useExportReport();
  const run = async () => {
    try {
      await exporter.mutateAsync({ name, period });
    } catch (error) {
      toast.error(t('export.failed'), getErrorMessage(error, t));
    }
  };
  return (
    <Button size="sm" icon={<Download />} loading={exporter.isPending} onClick={() => void run()}>
      {t('export.csv')}
    </Button>
  );
}
