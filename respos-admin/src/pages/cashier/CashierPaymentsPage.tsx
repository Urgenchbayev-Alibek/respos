import { useTranslation } from 'react-i18next';
import { useCurrentShift } from '@/entities/cash-shift/cash-shift.queries';
import { PaymentsTable } from '@/features/payments/ui/PaymentsTable';
import { EmptyState, PageHeader, PageLoader } from '@/shared/ui';
import { useCashierRealtime } from './use-cashier-realtime';

/** Payments of the current shift (refunds from here too). */
export function CashierPaymentsPage() {
  const { t } = useTranslation('cashier');
  const shift = useCurrentShift();
  useCashierRealtime();

  return (
    <>
      <PageHeader title={t('paymentsPage.title')} description={t('paymentsPage.description')} />
      {shift.isPending ? (
        <PageLoader />
      ) : shift.data ? (
        <PaymentsTable filters={{ shiftId: shift.data.id }} />
      ) : (
        <EmptyState title={t('shift.noShift')} />
      )}
    </>
  );
}
