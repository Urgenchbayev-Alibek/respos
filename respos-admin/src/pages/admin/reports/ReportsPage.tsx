import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReportPeriod } from '@/entities/report/report.types';
import { isValidPeriod, presetPeriod, type PeriodPreset } from '@/features/reports/model/period';
import { PeriodPicker } from '@/features/reports/ui/PeriodPicker';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Alert, PageHeader, Tabs, Toolbar } from '@/shared/ui';
import {
  CashShiftsReport,
  CategoriesReport,
  MovementTotalsReport,
  PaymentMethodsReport,
  StockReports,
  TopItemsReport,
} from './ReportSections';
import { AbcReport, FoodCostReport } from './AbcFoodCostReports';
import { SalesReport } from './SalesReport';
import { DiscountsCancellationsReport, HeatmapReport, WaitersReport } from './StaffHeatmapReports';

const TABS = ['sales', 'items', 'categories', 'payments', 'stock', 'movements', 'shifts'] as const;
/** F5 analytics tabs (labels in the `analytics` namespace). */
const ANALYTICS_TABS = ['abc', 'foodCost', 'waiters', 'heatmap', 'discounts'] as const;
type ReportTab = (typeof TABS)[number] | (typeof ANALYTICS_TABS)[number];
const isAnalyticsTab = (tab: ReportTab) => (ANALYTICS_TABS as readonly string[]).includes(tab);
const PERIODLESS: readonly ReportTab[] = ['stock', 'foodCost'];

/** Server-calculated reports for the current branch, period in branch timezone. */
export function ReportsPage() {
  const { t } = useTranslation('reports');
  const { t: ta } = useTranslation('analytics');
  const { timeZone } = useFormatters();
  const [tab, setTab] = useState<ReportTab>('sales');
  const [preset, setPreset] = useState<PeriodPreset>('7d');
  const [period, setPeriod] = useState<ReportPeriod>(() => presetPeriod('7d', timeZone));

  const changePreset = (next: PeriodPreset) => {
    setPreset(next);
    if (next !== 'custom') setPeriod(presetPeriod(next, timeZone));
  };
  const valid = isValidPeriod(period);
  const usesPeriod = !PERIODLESS.includes(tab);
  const tabLabel = (id: ReportTab) => (isAnalyticsTab(id) ? ta(`tabs.${id}`) : t(`tabs.${id}`));

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <Tabs ariaLabel={t('title')} items={[...TABS, ...ANALYTICS_TABS].map((id) => ({ id, label: tabLabel(id) }))} value={tab} onChange={(id) => setTab(id as ReportTab)} />
      {usesPeriod && (
        <Toolbar>
          <PeriodPicker preset={preset} period={period} onPresetChange={changePreset} onCustomChange={setPeriod} />
        </Toolbar>
      )}
      <div role="tabpanel" aria-label={tabLabel(tab)}>
        {usesPeriod && !valid ? (
          <Alert>{t('period.invalid')}</Alert>
        ) : (
          <>
            {tab === 'sales' && <SalesReport period={period} />}
            {tab === 'items' && <TopItemsReport period={period} />}
            {tab === 'categories' && <CategoriesReport period={period} />}
            {tab === 'payments' && <PaymentMethodsReport period={period} />}
            {tab === 'stock' && <StockReports />}
            {tab === 'movements' && <MovementTotalsReport period={period} />}
            {tab === 'shifts' && <CashShiftsReport period={period} />}
            {tab === 'abc' && <AbcReport period={period} />}
            {tab === 'foodCost' && <FoodCostReport />}
            {tab === 'waiters' && <WaitersReport period={period} />}
            {tab === 'heatmap' && <HeatmapReport period={period} />}
            {tab === 'discounts' && <DiscountsCancellationsReport period={period} />}
          </>
        )}
      </div>
    </>
  );
}
