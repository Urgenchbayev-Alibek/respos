import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Armchair, ClipboardList, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { dashboardKeys, useDashboard } from '@/entities/dashboard/dashboard.queries';
import { dashboardOverviewKeys, useDashboardOverview } from '@/entities/report/analytics.queries';
import type { DashboardPeriod } from '@/entities/report/analytics.types';
import reportStyles from '@/features/reports/ui/reports.module.css';
import { ROUTES } from '@/shared/constants/routes';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { useRealtimeEvent } from '@/shared/realtime';
import { Card, DemoBadge, EmptyState, ErrorState, PageHeader, StatCard, StatusBadge } from '@/shared/ui';
import { CardSkeleton, DishesCards, FoodCostAlertCard, OverviewKpis } from './DashboardOverviewCards';
import styles from './DashboardPage.module.css';

const PERIODS: DashboardPeriod[] = ['today', '7d', '30d'];

/** Owner dashboard v2: period KPIs (Δ %, sparklines), live operations, top/bottom dishes, food-cost alerts. */
export function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: ta } = useTranslation('analytics');
  const format = useFormatters();
  const { branch } = useCurrentBranch();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<DashboardPeriod>('today');
  const live = useDashboard();
  const overview = useDashboardOverview(period);
  const data = live.data;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    void queryClient.invalidateQueries({ queryKey: dashboardOverviewKeys.all });
  };
  useRealtimeEvent('OrderUpdated', invalidate);
  useRealtimeEvent('PaymentRegistered', invalidate);
  useRealtimeEvent('StockLow', invalidate);

  const header = (
    <PageHeader
      title={t('title')}
      description={branch ? t('subtitle', { branch: branch.name }) : undefined}
      meta={data?.isDemoData || overview.data?.isDemoData ? <DemoBadge title={t('demoHint')} /> : undefined}
    />
  );

  if (!branch) {
    return (
      <>
        {header}
        <EmptyState title={t('noBranchTitle')} description={t('noBranchDescription')} />
      </>
    );
  }

  if (live.error && !data) {
    return (
      <>
        {header}
        <ErrorState error={live.error} title={t('loadError')} onRetry={() => void live.refetch()} />
      </>
    );
  }

  const loading = live.isLoading || !data;
  const overviewLoading = !overview.data;
  return (
    <>
      {header}
      <div className={styles.periodBar}>
        <div role="group" aria-label={ta('dashboard.period')} className={reportStyles.segmented}>
          {PERIODS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              className={clsx(reportStyles.segment, period === value && reportStyles.segmentActive)}
              onClick={() => setPeriod(value)}
            >
              {ta(`dashboard.periods.${value}`)}
            </button>
          ))}
        </div>
      </div>
      {overview.error && !overview.data ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : (
        <OverviewKpis data={overview.data} loading={overviewLoading} stale={overview.isPlaceholderData} />
      )}
      <div className={styles.stats}>
        <StatCard label={t('activeOrders')} value={data?.activeOrders ?? 0} icon={<ClipboardList />} loading={loading} />
        <StatCard
          label={t('tablesOccupied')}
          value={t('tablesValue', { occupied: data?.tablesOccupied ?? 0, total: data?.tablesTotal ?? 0 })}
          icon={<Armchair />}
          loading={loading}
        />
        <StatCard
          label={t('lowStock')}
          value={data?.lowStockCount ?? 0}
          icon={<TriangleAlert />}
          tone={data && data.lowStockCount > 0 ? 'warning' : 'default'}
          hint={data && data.lowStockCount > 0 ? <Link to={ROUTES.admin.inventory}>{t('lowStockLink')}</Link> : undefined}
          loading={loading}
        />
      </div>
      <div className={styles.grid3}>
        <DishesCards data={overview.data} loading={overviewLoading} />
        <FoodCostAlertCard data={overview.data} loading={overviewLoading} />
        <Card title={t('shift')}>
          {loading ? (
            <CardSkeleton />
          ) : data.currentShift ? (
            <div className={styles.shift}>
              <StatusBadge domain="cashShift" status="open" size="lg" />
              <p>{t('shiftOpened', { name: data.currentShift.openedByName ?? '—', time: format.dateTime(data.currentShift.openedAt) })}</p>
            </div>
          ) : (
            <div className={styles.shift}>
              <StatusBadge domain="cashShift" status="closed" size="lg" />
              <p className={styles.muted}>{t('noShift')}</p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
