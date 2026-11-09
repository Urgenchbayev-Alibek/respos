import { useTranslation } from 'react-i18next';
import { useSalesReport } from '@/entities/report/report.queries';
import type { ReportPeriod } from '@/entities/report/report.types';
import { ExportButton } from '@/features/reports/ui/ExportButton';
import styles from '@/features/reports/ui/reports.module.css';
import { RevenueByDayChart } from '@/features/reports/ui/RevenueByDayChart';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Card, DemoBadge, EmptyState, ErrorState, StatCard } from '@/shared/ui';

/** KPIs + revenue by day. */
export function SalesReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('reports');
  const format = useFormatters();
  const query = useSalesReport(period);
  const data = query.data;

  if (query.error && !data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const isEmpty = data !== undefined && data.ordersCount === 0 && data.byDay.every((day) => day.revenue === 0);

  return (
    <div className={styles.stack}>
      <div className={styles.stats}>
        <StatCard label={t('sales.totalRevenue')} value={format.money(data?.totalRevenue)} loading={!data} />
        <StatCard label={t('sales.ordersCount')} value={data ? format.number(data.ordersCount, 0) : '—'} loading={!data} />
        <StatCard label={t('sales.averageCheck')} value={format.money(data?.averageCheck)} loading={!data} />
      </div>
      <Card
        title={t('sales.byDay')}
        actions={
          <>
            {data?.isDemoData && <DemoBadge />}
            <ExportButton name="sales" period={period} />
          </>
        }
      >
        {isEmpty ? <EmptyState compact title={t('emptyPeriod')} /> : data && <RevenueByDayChart days={data.byDay} />}
      </Card>
    </div>
  );
}
