import clsx from 'clsx';
import { Lock, Unlock } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentShift } from '@/entities/cash-shift/cash-shift.queries';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { Button, ErrorState, Skeleton, StatusBadge } from '@/shared/ui';
import { CloseShiftModal } from './CloseShiftModal';
import { OpenShiftModal } from './OpenShiftModal';
import styles from './ShiftBanner.module.css';

/** Current cash shift strip with open/close actions (one open shift per branch in MVP). */
export function ShiftBanner() {
  const { t } = useTranslation('cashier');
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const shiftQuery = useCurrentShift();
  const [modal, setModal] = useState<'open' | 'close' | null>(null);
  const shift = shiftQuery.data;

  if (shiftQuery.isPending) return <Skeleton height={56} />;
  if (shiftQuery.isError) return <ErrorState compact error={shiftQuery.error} onRetry={() => void shiftQuery.refetch()} />;

  return (
    <section className={clsx(styles.banner, !shift && styles.closed)} aria-label={t('shift.region')}>
      <StatusBadge domain="cashShift" status={shift ? 'open' : 'closed'} />
      {shift ? (
        <>
          <span className={styles.muted}>
            {t('shift.openedBy', { time: format.time(shift.openedAt), name: shift.openedByName ?? '—' })}
          </span>
          <span>
            {t('shift.opening')}: <strong>{format.money(shift.openingAmount)}</strong>
          </span>
          {shift.expectedCashAmount !== null && (
            <span>
              {t('shift.expectedCash')}: <strong>{format.money(shift.expectedCashAmount)}</strong>
            </span>
          )}
        </>
      ) : (
        <span>{t('shift.noShift')}</span>
      )}
      <span className={styles.spacer} />
      {!shift && hasPermission(PERMISSIONS.cashShifts.open) && (
        <Button variant="primary" icon={<Unlock />} onClick={() => setModal('open')}>
          {t('shift.open')}
        </Button>
      )}
      {shift && hasPermission(PERMISSIONS.cashShifts.close) && (
        <Button icon={<Lock />} onClick={() => setModal('close')}>
          {t('shift.close')}
        </Button>
      )}
      {modal === 'open' && <OpenShiftModal onClose={() => setModal(null)} />}
      {modal === 'close' && shift && <CloseShiftModal shift={shift} onClose={() => setModal(null)} />}
    </section>
  );
}
