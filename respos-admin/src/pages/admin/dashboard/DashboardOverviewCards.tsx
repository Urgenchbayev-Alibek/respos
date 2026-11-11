import clsx from 'clsx';
import { Banknote, Receipt, ShoppingBasket, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { DashboardOverviewDto } from '@/entities/report/analytics.types';
import analytics from '@/features/reports/ui/analytics.module.css';
import { DeltaBadge } from '@/features/reports/ui/DeltaBadge';
import { Sparkline } from '@/features/reports/ui/Sparkline';
import { ROUTES } from '@/shared/constants/routes';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Card, EmptyState, Skeleton, StatCard, StatusBadge } from '@/shared/ui';
import { TopItemsList } from './TopItemsList';
import styles from './DashboardPage.module.css';

type Data = DashboardOverviewDto | undefined;

/** Same block `TopItemsList` shows while loading, so a card body never collapses to nothing. */
export function CardSkeleton() {
  return (
    <div className={styles.skeletonList}>
      <Skeleton height={18} />
      <Skeleton height={18} />
      <Skeleton height={18} />
    </div>
  );
}

/**
 * Period KPIs with Δ % vs the previous equal period and a sparkline (revenue / orders).
 * The hint slot keeps its height before the data arrives; `stale` marks the previous period's numbers.
 */
export function OverviewKpis({ data, loading, stale }: { data: Data; loading: boolean; stale?: boolean }) {
  const { t } = useTranslation('analytics');
  const format = useFormatters();
  const revenue = data?.sparkline.map((point) => point.revenue) ?? [];
  const orders = data?.sparkline.map((point) => point.orders) ?? [];
  const hint = (delta: number | null | undefined, values?: number[]) => {
    const slot = clsx(analytics.kpiHint, values ? analytics.kpiHintSpark : analytics.kpiHintPlain);
    if (!data) return <span className={slot} />;
    return (
      <span className={slot}>
        <DeltaBadge value={delta} />
        {values && <Sparkline values={values} />}
      </span>
    );
  };
  return (
    <div className={styles.stats} aria-busy={stale || undefined}>
      <StatCard label={t('kpi.revenue')} value={format.money(data?.current.revenue)} icon={<Banknote />} hint={hint(data?.deltas.revenue, revenue)} loading={loading} />
      <StatCard
        label={t('kpi.orders')}
        value={data ? format.number(data.current.ordersCount, 0) : 0}
        icon={<Receipt />}
        hint={hint(data?.deltas.ordersCount, orders)}
        loading={loading}
      />
      <StatCard label={t('kpi.averageCheck')} value={format.money(data?.current.averageCheck)} icon={<Wallet />} hint={hint(data?.deltas.averageCheck)} loading={loading} />
      <StatCard
        label={t('kpi.itemsSold')}
        value={data ? format.number(data.current.itemsSold) : 0}
        icon={<ShoppingBasket />}
        hint={hint(data?.deltas.itemsSold)}
        loading={loading}
      />
    </div>
  );
}

export function DishesCards({ data, loading }: { data: Data; loading: boolean }) {
  const { t } = useTranslation('analytics');
  return (
    <>
      <Card title={t('dashboard.topItems')}>
        <TopItemsList items={data?.topItems} loading={loading} emptyTitle={t('dashboard.noSales')} />
      </Card>
      <Card title={t('dashboard.bottomItems')}>
        <TopItemsList items={data?.bottomItems} loading={loading} emptyTitle={t('dashboard.noBottomItems')} />
      </Card>
    </>
  );
}

/** Dishes whose current recipe cost exceeds the food-cost threshold (top 5, details in Reports → Food cost). */
export function FoodCostAlertCard({ data, loading }: { data: Data; loading: boolean }) {
  const { t } = useTranslation('analytics');
  const format = useFormatters();
  const alerts = data?.foodCostAlerts;
  return (
    <Card
      title={t('dashboard.foodCostTitle')}
      actions={alerts && alerts.aboveThresholdCount > 0 ? <StatusBadge tone="danger">{alerts.aboveThresholdCount}</StatusBadge> : undefined}
    >
      {loading || !alerts ? (
        <CardSkeleton />
      ) : alerts.items.length === 0 ? (
        <EmptyState compact title={t('dashboard.foodCostOk', { threshold: alerts.thresholdPercent })} />
      ) : (
        <div className={analytics.alertList}>
          <p className={analytics.muted}>{t('dashboard.foodCostHint', { threshold: alerts.thresholdPercent })}</p>
          <ul className={analytics.alertList}>
            {alerts.items.map((item) => (
              <li key={`${item.menuItemId}-${item.variantId ?? 'base'}`} className={analytics.alertRow}>
                <span>{item.variantName ? `${item.name} · ${item.variantName}` : item.name}</span>
                <StatusBadge tone="danger">{`${format.number(item.foodCostPercent, 1)} %`}</StatusBadge>
              </li>
            ))}
          </ul>
          <Link to={ROUTES.admin.reports}>{t('dashboard.openReports')}</Link>
        </div>
      )}
    </Card>
  );
}
