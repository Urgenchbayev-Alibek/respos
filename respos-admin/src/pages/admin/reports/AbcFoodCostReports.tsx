import clsx from 'clsx';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAbcReport, useFoodCostReport } from '@/entities/report/analytics.queries';
import type { AbcClass, AbcItemDto, AbcMetric, FoodCostItemDto } from '@/entities/report/analytics.types';
import type { ReportPeriod } from '@/entities/report/report.types';
import analytics from '@/features/reports/ui/analytics.module.css';
import { ExportMenu } from '@/features/reports/ui/ExportMenu';
import styles from '@/features/reports/ui/reports.module.css';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Alert, Card, DataTable, Input, StatusBadge, type DataTableColumn } from '@/shared/ui';

const METRICS: AbcMetric[] = ['revenue', 'quantity', 'margin'];
const CLASS_FILL: Record<AbcClass, string> = {
  A: 'var(--tone-success-fg)',
  B: 'var(--tone-warning-fg)',
  C: 'var(--tone-danger-fg)',
};
const CHART_ITEMS = 15;
const DEFAULT_THRESHOLD = 35;
const num = (value: string) => <span className={styles.num}>{value}</span>;

export function AbcClassBadge({ value }: { value: AbcClass }) {
  return <span className={clsx(analytics.classBadge, analytics[`class${value}`])}>{value}</span>;
}

/** ABC analysis: metric switch, class-coloured bar chart (top items) and the full table (accessible fallback). */
export function AbcReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('analytics');
  const format = useFormatters();
  const [metric, setMetric] = useState<AbcMetric>('revenue');
  const query = useAbcReport(period, metric);
  const items = query.data?.items;
  const show = (value: number) => (metric === 'quantity' ? format.number(value) : format.money(value));
  const columns: DataTableColumn<AbcItemDto>[] = [
    { key: 'class', header: t('abc.class'), width: '64px', cell: (row) => <AbcClassBadge value={row.class} /> },
    { key: 'name', header: t('columns.item'), cell: (row) => row.name },
    { key: 'qty', header: t('columns.quantity'), align: 'right', cell: (row) => num(format.number(row.quantity)) },
    { key: 'revenue', header: t('columns.revenue'), align: 'right', cell: (row) => num(format.money(row.revenue)) },
    { key: 'margin', header: t('columns.margin'), align: 'right', hideOnMobile: true, cell: (row) => num(format.money(row.margin)) },
    { key: 'share', header: t('abc.share'), align: 'right', cell: (row) => num(`${format.number(row.sharePercent, 2)} %`) },
    { key: 'cumulative', header: t('abc.cumulative'), align: 'right', hideOnMobile: true, cell: (row) => num(`${format.number(row.cumulativePercent, 2)} %`) },
  ];

  return (
    <div className={styles.stack}>
      <div className={analytics.toolbarRow}>
        <div role="group" aria-label={t('abc.metric')} className={styles.segmented}>
          {METRICS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={metric === value}
              className={clsx(styles.segment, metric === value && styles.segmentActive)}
              onClick={() => setMetric(value)}
            >
              {t(`abc.metrics.${value}`)}
            </button>
          ))}
        </div>
        <span className={analytics.muted}>{t('abc.legend')}</span>
      </div>
      {items && items.length > 0 && (
        <Card title={t('abc.chartTitle')}>
          <figure className={styles.chart} role="img" aria-label={t('abc.chartLabel')}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={items.slice(0, CHART_ITEMS)} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => show(value)} cursor={{ fill: 'var(--color-primary-subtle)' }} />
                <Bar dataKey="value" name={t(`abc.metrics.${metric}`)} isAnimationActive={false} radius={[0, 4, 4, 0]}>
                  {items.slice(0, CHART_ITEMS).map((item) => (
                    <Cell key={item.menuItemId} fill={CLASS_FILL[item.class]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </figure>
        </Card>
      )}
      <Card title={t('tabs.abc')} flush actions={<ExportMenu name="abc" period={period} params={{ metric }} />}>
        <DataTable
          caption={t('tabs.abc')}
          columns={columns}
          rows={items}
          getRowId={(row) => row.menuItemId}
          isLoading={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          emptyTitle={t('emptyPeriod')}
        />
      </Card>
    </div>
  );
}

/** Food cost per dish vs the threshold (default 35 %), alerts first. */
export function FoodCostReport() {
  const { t } = useTranslation('analytics');
  const format = useFormatters();
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const valid = threshold >= 1 && threshold <= 100;
  const query = useFoodCostReport(valid ? threshold : DEFAULT_THRESHOLD);
  const data = query.data;
  const columns: DataTableColumn<FoodCostItemDto>[] = [
    { key: 'name', header: t('columns.item'), cell: (row) => (row.variantName ? `${row.name} · ${row.variantName}` : row.name) },
    { key: 'category', header: t('columns.category'), hideOnMobile: true, cell: (row) => row.categoryName },
    { key: 'price', header: t('columns.price'), align: 'right', cell: (row) => num(format.money(row.price)) },
    { key: 'cost', header: t('foodCost.recipeCost'), align: 'right', cell: (row) => num(row.hasRecipe ? format.money(row.recipeCost) : '—') },
    {
      key: 'percent',
      header: t('foodCost.percent'),
      align: 'right',
      cell: (row) =>
        row.foodCostPercent === null ? (
          <StatusBadge tone="neutral">{t('foodCost.noRecipe')}</StatusBadge>
        ) : row.isAboveThreshold ? (
          <StatusBadge tone="danger">{`${format.number(row.foodCostPercent, 2)} %`}</StatusBadge>
        ) : (
          num(`${format.number(row.foodCostPercent, 2)} %`)
        ),
    },
    { key: 'margin', header: t('columns.margin'), align: 'right', hideOnMobile: true, cell: (row) => num(format.money(row.marginAmount)) },
    {
      key: 'flags',
      header: t('foodCost.notes'),
      hideOnMobile: true,
      cell: (row) => (row.hasMissingConversions ? <StatusBadge tone="warning">{t('foodCost.missingConversion')}</StatusBadge> : null),
    },
  ];

  return (
    <div className={styles.stack}>
      <div className={analytics.toolbarRow}>
        <label className={analytics.toolbarRow}>
          <span>{t('foodCost.threshold')}</span>
          <Input
            type="number"
            min={1}
            max={100}
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
            style={{ width: 96 }}
            aria-invalid={!valid || undefined}
          />
        </label>
      </div>
      {data && data.aboveThresholdCount > 0 && (
        <Alert>{t('foodCost.alert', { count: data.aboveThresholdCount, threshold: data.thresholdPercent })}</Alert>
      )}
      <Card title={t('tabs.foodCost')} flush actions={<ExportMenu name="food-cost" params={{ threshold: valid ? threshold : DEFAULT_THRESHOLD }} />}>
        <DataTable
          caption={t('tabs.foodCost')}
          columns={columns}
          rows={data?.items}
          getRowId={(row) => `${row.menuItemId}-${row.variantId ?? 'base'}`}
          isLoading={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          emptyTitle={t('empty')}
        />
      </Card>
    </div>
  );
}
