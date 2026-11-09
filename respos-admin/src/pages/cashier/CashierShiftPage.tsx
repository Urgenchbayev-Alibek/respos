import { useTranslation } from 'react-i18next';
import { useCurrentShift } from '@/entities/cash-shift/cash-shift.queries';
import { ShiftBanner } from '@/features/cash-shifts/ui/ShiftBanner';
import { ShiftTotals } from '@/features/cash-shifts/ui/ShiftTotals';
import { Card, PageHeader } from '@/shared/ui';
import { useCashierRealtime } from './use-cashier-realtime';

/** Current shift: open/close and live server totals by method (`GET /cash-shifts/current` carries totalsByMethod). */
export function CashierShiftPage() {
  const { t } = useTranslation('cashier');
  const current = useCurrentShift();
  useCashierRealtime();

  return (
    <>
      <PageHeader title={t('shift.pageTitle')} />
      <ShiftBanner />
      {current.data && (
        <Card title={t('shift.totalsTitle')}>
          <ShiftTotals shift={current.data} />
        </Card>
      )}
    </>
  );
}
