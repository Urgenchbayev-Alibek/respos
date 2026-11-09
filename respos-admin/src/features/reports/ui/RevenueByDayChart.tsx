import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import type { SalesReportDto } from '@/entities/report/report.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Button, DataTable, type DataTableColumn } from '@/shared/ui';
import styles from './reports.module.css';

type Day = SalesReportDto['byDay'][number];

const BAR_FILL = 'var(--color-primary-strong)';
const GRID = 'var(--color-border)';
const AXIS_TEXT = 'var(--color-text-muted)';

/** Date-only `YYYY-MM-DD` → short label without timezone shifts. */
const shortDate = (date: string) => {
  const [, month, day] = date.split('-');
  return `${day}.${month}`;
};

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  const { t } = useTranslation('reports');
  const format = useFormatters();
  const day = payload?.[0]?.payload as Day | undefined;
  if (!active || !day) return null;
  return (
    <div className={styles.tooltip}>
      <strong>{shortDate(day.date)}</strong>
      {t('sales.revenue')}: {format.money(day.revenue)}
      <br />
      {t('sales.orders')}: {day.orders}
    </div>
  );
}

/**
 * Single-series bar chart (one hue → no legend; the card title names it) with hover tooltip and an
 * accessible data-table view for screen readers / exact values.
 */
export function RevenueByDayChart({ days }: { days: Day[] }) {
  const { t, i18n } = useTranslation('reports');
  const format = useFormatters();
  const [asTable, setAsTable] = useState(false);
  const columns: DataTableColumn<Day>[] = [
    { key: 'date', header: t('columns.date'), cell: (row) => format.date(`${row.date}T12:00:00Z`) },
    { key: 'revenue', header: t('sales.revenue'), align: 'right', cell: (row) => <span className={styles.num}>{format.money(row.revenue)}</span> },
    { key: 'orders', header: t('sales.orders'), align: 'right', cell: (row) => row.orders },
  ];

  return (
    <div className={styles.stack}>
      <div>
        <Button size="sm" variant="ghost" aria-pressed={asTable} onClick={() => setAsTable((value) => !value)}>
          {asTable ? t('sales.showChart') : t('sales.showTable')}
        </Button>
      </div>
      {asTable ? (
        <DataTable caption={t('sales.byDay')} columns={columns} rows={days} getRowId={(row) => row.date} />
      ) : (
        <figure className={styles.chart} aria-label={t('sales.chartLabel')} role="img">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: AXIS_TEXT, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis
                width={72}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => new Intl.NumberFormat(i18n.language, { notation: 'compact' }).format(value)}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-primary-subtle)' }} />
              <Bar dataKey="revenue" fill={BAR_FILL} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </figure>
      )}
    </div>
  );
}
