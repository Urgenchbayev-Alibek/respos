import clsx from 'clsx';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDiscountsCancellationsReport, useHeatmapReport, useWaitersReport } from '@/entities/report/analytics.queries';
import type { DiscountsCancellationsDto, StaffAmountDto, WaiterPerformanceDto } from '@/entities/report/analytics.types';
import type { ReportPeriod } from '@/entities/report/report.types';
import analytics from '@/features/reports/ui/analytics.module.css';
import { ExportMenu } from '@/features/reports/ui/ExportMenu';
import styles from '@/features/reports/ui/reports.module.css';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Card, DataTable, EmptyState, ErrorState, Skeleton, StatCard, type DataTableColumn } from '@/shared/ui';

type Props = { period: ReportPeriod };
const num = (value: string) => <span className={styles.num}>{value}</span>;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
/** Above this intensity the cell text switches to the on-primary colour for contrast. */
const DARK_CELL = 0.55;

export function WaitersReport({ period }: Props) {
  const { t } = useTranslation('analytics');
  const format = useFormatters();
  const query = useWaitersReport(period);
  const columns: DataTableColumn<WaiterPerformanceDto>[] = [
    { key: 'name', header: t('columns.waiter'), cell: (row) => row.name || '—' },
    { key: 'orders', header: t('columns.orders'), align: 'right', cell: (row) => num(format.number(row.ordersCount, 0)) },
    { key: 'revenue', header: t('columns.revenue'), align: 'right', cell: (row) => num(format.money(row.revenue)) },
    { key: 'avg', header: t('columns.averageCheck'), align: 'right', cell: (row) => num(format.money(row.averageCheck)) },
    { key: 'items', header: t('columns.itemsSold'), align: 'right', hideOnMobile: true, cell: (row) => num(format.number(row.itemsSold)) },
    { key: 'cancelled', header: t('columns.cancellations'), align: 'right', hideOnMobile: true, cell: (row) => num(`${row.cancelledOrders} / ${row.cancelledItems}`) },
    { key: 'discounts', header: t('columns.discounts'), align: 'right', hideOnMobile: true, cell: (row) => num(format.money(row.discountsAmount)) },
    { key: 'tips', header: t('columns.tips'), align: 'right', hideOnMobile: true, cell: (row) => num(format.money(row.tipsAmount)) },
  ];
  return (
    <Card title={t('tabs.waiters')} flush actions={<ExportMenu name="waiters" period={period} />}>
      <DataTable
        caption={t('tabs.waiters')}
        columns={columns}
        rows={query.data}
        getRowId={(row) => row.waiterId}
        isLoading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('emptyPeriod')}
      />
    </Card>
  );
}

/** Weekday × hour grid (branch timezone). The grid is a real table, so values are readable without colour. */
export function HeatmapReport({ period }: Props) {
  const { t, i18n } = useTranslation('analytics');
  const format = useFormatters();
  const [metric, setMetric] = useState<'orders' | 'revenue'>('orders');
  const query = useHeatmapReport(period);
  const data = query.data;
  if (query.error && !data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const max = data ? (metric === 'orders' ? data.maxOrders : data.maxRevenue) : 0;
  const cell = (weekday: number, hour: number) => data?.cells.find((c) => c.weekday === weekday && c.hour === hour);
  return (
    <Card title={t('tabs.heatmap')} actions={<ExportMenu name="heatmap" period={period} />}>
      <div className={styles.stack}>
        <div className={analytics.toolbarRow}>
          <div role="group" aria-label={t('heatmap.metric')} className={styles.segmented}>
            {(['orders', 'revenue'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={metric === value}
                className={clsx(styles.segment, metric === value && styles.segmentActive)}
                onClick={() => setMetric(value)}
              >
                {t(`heatmap.${value}`)}
              </button>
            ))}
          </div>
          <span className={analytics.legend} aria-hidden="true">
            0 <span className={analytics.legendScale} /> {metric === 'orders' ? max : format.money(max)}
          </span>
        </div>
        {!data ? (
          <Skeleton height={220} />
        ) : max === 0 ? (
          <EmptyState compact title={t('emptyPeriod')} />
        ) : (
          <div className={analytics.heatmapWrap}>
            <table className={analytics.heatmap}>
              <caption className={analytics.srOnly}>{t('heatmap.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('heatmap.weekday')}</th>
                  {HOURS.map((hour) => (
                    <th key={hour} scope="col">{String(hour).padStart(2, '0')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS.map((weekday) => (
                  <tr key={weekday}>
                    <th scope="row">{t(`weekdays.${weekday}`)}</th>
                    {HOURS.map((hour) => {
                      const value = cell(weekday, hour);
                      const amount = value ? (metric === 'orders' ? value.orders : value.revenue) : 0;
                      const intensity = max > 0 ? amount / max : 0;
                      const label = metric === 'orders' ? String(amount) : format.money(amount);
                      return (
                        <td
                          key={hour}
                          title={`${t(`weekdays.${weekday}`)} ${String(hour).padStart(2, '0')}:00 — ${label}`}
                          style={{
                            background: `color-mix(in srgb, var(--color-primary-strong) ${Math.round(intensity * 100)}%, var(--color-surface-muted))`,
                            color: intensity > DARK_CELL ? 'var(--color-on-primary)' : undefined,
                          }}
                        >
                          {amount === 0 ? '' : metric === 'orders' ? amount : new Intl.NumberFormat(i18n.language, { notation: 'compact' }).format(amount)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function StaffTable({ title, rows, countHeader }: { title: string; rows: StaffAmountDto[]; countHeader: string }) {
  const { t } = useTranslation('analytics');
  const format = useFormatters();
  const columns: DataTableColumn<StaffAmountDto>[] = [
    { key: 'name', header: t('columns.waiter'), cell: (row) => row.name || '—' },
    { key: 'count', header: countHeader, align: 'right', cell: (row) => num(format.number(row.count, 0)) },
    { key: 'amount', header: t('columns.amount'), align: 'right', cell: (row) => num(format.money(row.amount)) },
  ];
  return (
    <Card title={title} flush>
      <DataTable caption={title} columns={columns} rows={rows} getRowId={(row) => row.waiterId} emptyTitle={t('emptyPeriod')} />
    </Card>
  );
}

type Reason = DiscountsCancellationsDto['cancellations']['byReason'][number];

export function DiscountsCancellationsReport({ period }: Props) {
  const { t } = useTranslation('analytics');
  const format = useFormatters();
  const query = useDiscountsCancellationsReport(period);
  const data = query.data;
  if (query.error && !data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const reasonColumns: DataTableColumn<Reason>[] = [
    { key: 'reason', header: t('columns.reason'), cell: (row) => row.reason || t('discounts.noReason') },
    { key: 'orders', header: t('columns.orders'), align: 'right', cell: (row) => num(format.number(row.ordersCount, 0)) },
    { key: 'items', header: t('columns.items'), align: 'right', cell: (row) => num(format.number(row.itemsCount, 0)) },
    { key: 'amount', header: t('columns.amount'), align: 'right', cell: (row) => num(format.money(row.amount)) },
  ];
  return (
    <div className={styles.stack}>
      <div className={analytics.toolbarRow}>
        <ExportMenu name="discounts-cancellations" period={period} />
      </div>
      <div className={styles.stats}>
        <StatCard label={t('discounts.discountedOrders')} value={data ? format.number(data.discounts.ordersCount, 0) : '—'} loading={!data} />
        <StatCard label={t('discounts.discountsAmount')} value={format.money(data?.discounts.amount)} loading={!data} />
        <StatCard
          label={t('discounts.cancelledOrders')}
          value={data ? format.number(data.cancellations.ordersCount, 0) : '—'}
          hint={data ? format.money(data.cancellations.ordersAmount) : undefined}
          loading={!data}
        />
        <StatCard
          label={t('discounts.cancelledItems')}
          value={data ? format.number(data.cancellations.itemsCount, 0) : '—'}
          hint={data ? format.money(data.cancellations.itemsAmount) : undefined}
          tone={data && data.cancellations.itemsCount > 0 ? 'warning' : 'default'}
          loading={!data}
        />
      </div>
      <Card title={t('discounts.byReason')} flush>
        <DataTable
          caption={t('discounts.byReason')}
          columns={reasonColumns}
          rows={data?.cancellations.byReason}
          getRowId={(row) => row.reason}
          isLoading={query.isFetching}
          emptyTitle={t('emptyPeriod')}
        />
      </Card>
      {data && (
        <div className={analytics.grid2}>
          <StaffTable title={t('discounts.discountsByWaiter')} rows={data.discounts.byWaiter} countHeader={t('columns.orders')} />
          <StaffTable title={t('discounts.cancellationsByWaiter')} rows={data.cancellations.byWaiter} countHeader={t('columns.cancellations')} />
        </div>
      )}
    </div>
  );
}
