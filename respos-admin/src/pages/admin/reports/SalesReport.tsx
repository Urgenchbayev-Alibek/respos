import { useTranslation } from 'react-i18next';
import { useSalesSummary } from '@/entities/report/analytics.queries';
import type { ReportPeriod } from '@/entities/report/report.types';
import { DeltaBadge } from '@/features/reports/ui/DeltaBadge';
import { ExportMenu } from '@/features/reports/ui/ExportMenu';
import styles from '@/features/reports/ui/reports.module.css';
import analyticsStyles from '@/features/reports/ui/analytics.module.css';
import { RevenueByDayChart } from '@/features/reports/ui/RevenueByDayChart';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Card, EmptyState, ErrorState, StatCard } from '@/shared/ui';

/** KPIs with Δ % vs the previous equal period + revenue by day. */
export function SalesReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('reports');
  const { t: ta } = useTranslation('analytics');
  const format = useFormatters();
  const query = useSalesSummary(period);
  const data = query.data;

  if (query.error && !data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const isEmpty = data !== undefined && data.current.ordersCount === 0 && data.byDay.every((day) => day.revenue === 0);
  const hint = (delta: number | null | undefined, invert = false) =>
    data ? (
      <span className={analyticsStyles.kpiHint}>
        <DeltaBadge value={delta} invert={invert} />
      </span>
    ) : undefined;

  return (
    <div className={styles.stack}>
      <div className={analyticsStyles.toolbarRow}>
        {data && (
          <span className={analyticsStyles.muted}>
            {ta('delta.previousPeriod', { from: format.date(`${data.previousFrom}T12:00:00Z`), to: format.date(`${data.previousTo}T12:00:00Z`) })}
          </span>
        )}
        <ExportMenu name="sales-summary" period={period} />
      </div>
      <div className={styles.stats}>
        <StatCard label={t('sales.totalRevenue')} value={format.money(data?.current.revenue)} hint={hint(data?.deltas.revenue)} loading={!data} />
        <StatCard
          label={t('sales.ordersCount')}
          value={data ? format.number(data.current.ordersCount, 0) : '—'}
          hint={hint(data?.deltas.ordersCount)}
          loading={!data}
        />
        <StatCard label={t('sales.averageCheck')} value={format.money(data?.current.averageCheck)} hint={hint(data?.deltas.averageCheck)} loading={!data} />
        <StatCard
          label={ta('kpi.discounts')}
          value={format.money(data?.current.discountsAmount)}
          hint={hint(data?.deltas.discountsAmount, true)}
          loading={!data}
        />
      </div>
      <Card title={t('sales.byDay')} actions={<ExportMenu name="sales" period={period} />}>
        {isEmpty ? <EmptyState compact title={t('emptyPeriod')} /> : data && <RevenueByDayChart days={data.byDay} />}
      </Card>
    </div>
  );
}
