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
import { SalesReport } from './SalesReport';

const TABS = ['sales', 'items', 'categories', 'payments', 'stock', 'movements', 'shifts'] as const;
type ReportTab = (typeof TABS)[number];

/** Server-calculated reports for the current branch, period in branch timezone. */
export function ReportsPage() {
  const { t } = useTranslation('reports');
  const { timeZone } = useFormatters();
  const [tab, setTab] = useState<ReportTab>('sales');
  const [preset, setPreset] = useState<PeriodPreset>('7d');
  const [period, setPeriod] = useState<ReportPeriod>(() => presetPeriod('7d', timeZone));

  const changePreset = (next: PeriodPreset) => {
    setPreset(next);
    if (next !== 'custom') setPeriod(presetPeriod(next, timeZone));
  };
  const valid = isValidPeriod(period);
  const usesPeriod = tab !== 'stock';

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <Tabs ariaLabel={t('title')} items={TABS.map((id) => ({ id, label: t(`tabs.${id}`) }))} value={tab} onChange={(id) => setTab(id as ReportTab)} />
      {usesPeriod && (
        <Toolbar>
          <PeriodPicker preset={preset} period={period} onPresetChange={changePreset} onCustomChange={setPeriod} />
        </Toolbar>
      )}
      <div role="tabpanel" aria-label={t(`tabs.${tab}`)}>
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
          </>
        )}
      </div>
    </>
  );
}
