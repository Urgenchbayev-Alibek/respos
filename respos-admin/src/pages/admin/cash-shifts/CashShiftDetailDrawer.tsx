import { useTranslation } from 'react-i18next';
import { useCashShift } from '@/entities/cash-shift/cash-shift.queries';
import { ShiftTotals } from '@/features/cash-shifts/ui/ShiftTotals';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Drawer, ErrorState, PageLoader, StatusBadge } from '@/shared/ui';

export function CashShiftDetailDrawer({ shiftId, onClose }: { shiftId: string; onClose: () => void }) {
  const { t } = useTranslation('payments');
  const format = useFormatters();
  const query = useCashShift(shiftId);

  return (
    <Drawer open onClose={onClose} title={t('shifts.detailTitle')} width={480}>
      {query.isPending ? (
        <PageLoader />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <p>
            <StatusBadge domain="cashShift" status={query.data.status} />
          </p>
          <p>
            {t('shifts.openedLine', { time: format.dateTime(query.data.openedAt), name: query.data.openedByName ?? '—' })}
            {query.data.closedAt && (
              <>
                <br />
                {t('shifts.closedLine', { time: format.dateTime(query.data.closedAt), name: query.data.closedByName ?? '—' })}
              </>
            )}
          </p>
          <ShiftTotals shift={query.data} />
        </>
      )}
    </Drawer>
  );
}
