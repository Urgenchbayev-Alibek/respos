import { useQueryClient } from '@tanstack/react-query';
import { Armchair, Banknote, ClipboardList, Receipt, TriangleAlert, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { dashboardKeys, useDashboard } from '@/entities/dashboard/dashboard.queries';
import { ROUTES } from '@/shared/constants/routes';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { useRealtimeEvent } from '@/shared/realtime';
import { Card, DemoBadge, EmptyState, ErrorState, PageHeader, StatCard, StatusBadge } from '@/shared/ui';
import { TopItemsList } from './TopItemsList';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const format = useFormatters();
  const { branch } = useCurrentBranch();
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useDashboard();

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  useRealtimeEvent('OrderUpdated', invalidate);
  useRealtimeEvent('PaymentRegistered', invalidate);
  useRealtimeEvent('StockLow', invalidate);

  const header = (
    <PageHeader
      title={t('title')}
      description={branch ? t('subtitle', { branch: branch.name }) : undefined}
      meta={data?.isDemoData ? <DemoBadge title={t('demoHint')} /> : undefined}
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

  if (error && !data) {
    return (
      <>
        {header}
        <ErrorState error={error} title={t('loadError')} onRetry={() => void refetch()} />
      </>
    );
  }

  const loading = isLoading || !data;
  return (
    <>
      {header}
      <div className={styles.stats}>
        <StatCard label={t('salesToday')} value={format.money(data?.salesToday)} icon={<Banknote />} loading={loading} />
        <StatCard label={t('ordersToday')} value={data?.ordersToday ?? 0} icon={<Receipt />} loading={loading} />
        <StatCard label={t('averageCheck')} value={format.money(data?.averageCheck)} icon={<Wallet />} loading={loading} />
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
      <div className={styles.grid}>
        <Card title={t('topItems')}>
          <TopItemsList items={data?.topItems} loading={loading} />
        </Card>
        <Card title={t('shift')}>
          {loading ? null : data.currentShift ? (
            <div className={styles.shift}>
              <StatusBadge domain="cashShift" status="open" size="lg" />
              <p>{t('shiftOpened', { name: data.currentShift.openedByName, time: format.dateTime(data.currentShift.openedAt) })}</p>
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
