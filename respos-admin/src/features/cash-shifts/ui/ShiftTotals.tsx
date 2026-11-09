import { useTranslation } from 'react-i18next';
import type { CashShiftDetailDto } from '@/entities/cash-shift/cash-shift.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { differenceTone, formatSignedMoney } from '../model/shift-format';
import { ShiftAmounts, type AmountRow } from './ShiftAmounts';

/** Shift detail: server totals by payment method + cash reconciliation. */
export function ShiftTotals({ shift }: { shift: CashShiftDetailDto }) {
  const { t } = useTranslation('cashier');
  const format = useFormatters();
  const byMethod: AmountRow[] = shift.totalsByMethod.map((total) => ({
    label: t(`payments:methods.${total.method}`),
    value: format.money(total.amount),
    testId: `total-${total.method}`,
  }));
  const reconciliation: AmountRow[] = [
    { label: t('shift.opening'), value: format.money(shift.openingAmount) },
    { label: t('shift.expected'), value: format.money(shift.expectedCashAmount) },
  ];
  if (shift.status === 'closed') {
    reconciliation.push(
      { label: t('shift.actual'), value: format.money(shift.actualCashAmount) },
      {
        label: t('shift.difference'),
        value: formatSignedMoney(shift.difference, format.money),
        tone: differenceTone(shift.difference),
        testId: 'shift-difference',
      },
    );
  }

  return (
    <>
      <h3>{t('shift.byMethod')}</h3>
      {byMethod.length === 0 ? <p>{t('shift.noPayments')}</p> : <ShiftAmounts rows={byMethod} />}
      <h3>{t('shift.reconciliation')}</h3>
      <ShiftAmounts rows={reconciliation} />
      {shift.comment && <p>{t('shift.commentValue', { comment: shift.comment })}</p>}
    </>
  );
}
