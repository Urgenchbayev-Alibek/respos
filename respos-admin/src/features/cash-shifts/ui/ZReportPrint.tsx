import { useTranslation } from 'react-i18next';
import type { CashShiftDto } from '@/entities/cash-shift/cash-shift.types';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { PrintArea, PrintDivider, PrintRow } from '@/shared/ui';
import { formatSignedMoney } from '../model/shift-format';

export const Z_REPORT_PRINT_ID = 'cash-shift-z-report';

/** 80 mm shift report: Z-report for a closed shift, X-report (interim) for an open one. Server totals only. */
export function ZReportPrint({ shift }: { shift: CashShiftDto }) {
  return (
    <PrintArea id={Z_REPORT_PRINT_ID}>
      <ZReportSlip shift={shift} />
    </PrintArea>
  );
}

export function ZReportSlip({ shift }: { shift: CashShiftDto }) {
  const { t } = useTranslation('ux');
  const format = useFormatters();
  const { branch } = useCurrentBranch();
  const closed = shift.status === 'closed';
  const total = shift.totalsByMethod.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div data-testid="z-report">
      <h2>{t(closed ? 'zReport.titleClosed' : 'zReport.titleOpen')}</h2>
      {branch && <p style={{ textAlign: 'center' }}>{branch.name}</p>}
      <PrintDivider />
      <PrintRow label={t('zReport.opened')} value={format.dateTime(shift.openedAt)} />
      <PrintRow label={t('zReport.by')} value={shift.openedByName ?? '—'} />
      {shift.closedAt && <PrintRow label={t('zReport.closed')} value={format.dateTime(shift.closedAt)} />}
      {shift.closedAt && <PrintRow label={t('zReport.by')} value={shift.closedByName ?? '—'} />}
      <PrintDivider />
      <p>
        <strong>{t('zReport.byMethod')}</strong>
      </p>
      {shift.totalsByMethod.length === 0 && <p>{t('zReport.noPayments')}</p>}
      {shift.totalsByMethod.map((row) => (
        <PrintRow key={row.method} label={t(`payments:methods.${row.method}`)} value={format.money(row.amount)} />
      ))}
      <PrintRow label={t('zReport.total')} value={format.money(total)} strong />
      <PrintDivider />
      <p>
        <strong>{t('zReport.cash')}</strong>
      </p>
      <PrintRow label={t('zReport.opening')} value={format.money(shift.openingAmount)} />
      <PrintRow label={t('zReport.cashPayments')} value={format.money(shift.cashPaymentsAmount)} />
      <PrintRow label={t('zReport.cashRefunds')} value={format.money(shift.cashRefundsAmount)} />
      <PrintRow label={t('zReport.expected')} value={format.money(shift.expectedCashAmount)} strong />
      {closed && <PrintRow label={t('zReport.actual')} value={format.money(shift.actualCashAmount)} />}
      {closed && <PrintRow label={t('zReport.difference')} value={formatSignedMoney(shift.difference, format.money)} strong />}
      {shift.comment && <p>{t('zReport.comment', { comment: shift.comment })}</p>}
      <PrintDivider />
      <p style={{ textAlign: 'center' }}>{t('zReport.notFiscal')}</p>
      <p style={{ textAlign: 'center' }}>{t('print.printedAt', { time: format.dateTime(new Date()) })}</p>
    </div>
  );
}
