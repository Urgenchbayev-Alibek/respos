import { useTranslation } from 'react-i18next';
import { useCashShift, useCurrentShift } from '@/entities/cash-shift/cash-shift.queries';
import { ShiftBanner } from '@/features/cash-shifts/ui/ShiftBanner';
import { ShiftTotals } from '@/features/cash-shifts/ui/ShiftTotals';
import { Card, ErrorState, PageHeader, Skeleton } from '@/shared/ui';
import { useCashierRealtime } from './use-cashier-realtime';

/** Current shift: open/close and live server totals by method. */
export function CashierShiftPage() {
  const { t } = useTranslation('cashier');
  const current = useCurrentShift();
  const detail = useCashShift(current.data?.id ?? null);
  useCashierRealtime();

  return (
    <>
      <PageHeader title={t('shift.pageTitle')} />
      <ShiftBanner />
      {current.data && (
        <Card title={t('shift.totalsTitle')}>
          {detail.isPending ? (
            <Skeleton height={120} />
          ) : detail.isError ? (
            <ErrorState compact error={detail.error} onRetry={() => void detail.refetch()} />
          ) : (
            <ShiftTotals shift={detail.data} />
          )}
        </Card>
      )}
    </>
  );
}
