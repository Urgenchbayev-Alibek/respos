import clsx from 'clsx';
import { Clock } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClockIn, useClockOut, useMyTimeClock } from '@/entities/staff/staff.queries';
import { formatMinutes, staffErrorMessage } from '@/features/staff/model/staff-errors';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { Alert, Button, FormField, Input, Modal, useToast } from '@/shared/ui';
import styles from './TopbarTrigger.module.css';

/** Topbar "Clock in / Clock out" for users with `staff.timeclock` (own record in the current branch). */
export function TimeClockButton() {
  const { hasPermission } = usePermissions();
  const { branch } = useCurrentBranch();
  const enabled = hasPermission(PERMISSIONS.staff.timeClock) && Boolean(branch);
  if (!enabled) return null;
  return <TimeClockControl />;
}

function TimeClockControl() {
  const { t } = useTranslation('staff');
  const format = useFormatters();
  const toast = useToast();
  const state = useMyTimeClock();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const [confirmOut, setConfirmOut] = useState(false);
  const [breakMinutes, setBreakMinutes] = useState('');
  const { branch } = useCurrentBranch();

  const open = state.data?.openEntry ?? null;
  const elsewhere = open !== null && open.branchId !== branch?.id;

  const doClockIn = async () => {
    try {
      await clockIn.mutateAsync({});
      toast.success(t('clock.clockedIn'));
    } catch (error) {
      toast.error(staffErrorMessage(error, t));
    }
  };

  const doClockOut = async () => {
    const minutes = breakMinutes.trim() === '' ? null : Number(breakMinutes);
    try {
      await clockOut.mutateAsync({ breakMinutes: minutes });
      setConfirmOut(false);
      setBreakMinutes('');
      toast.success(t('clock.clockedOut'));
    } catch {
      // The error is shown inside the dialog.
    }
  };

  if (state.isLoading || state.isError) return null;

  if (!open) {
    return (
      <button
        type="button"
        className={clsx(styles.trigger, styles.iconOnlyMobile)}
        onClick={() => void doClockIn()}
        disabled={clockIn.isPending}
      >
        <Clock aria-hidden="true" />
        <span className={clsx(styles.label, styles.labelWideOnly)}>{t('clock.clockIn')}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className={clsx(styles.trigger, styles.iconOnlyMobile)}
        onClick={() => setConfirmOut(true)}
        disabled={elsewhere}
        title={elsewhere ? t('clock.otherBranch') : undefined}
      >
        <Clock aria-hidden="true" />
        <span className={clsx(styles.label, styles.labelWideOnly)}>
          {t('clock.onShift', { time: format.time(open.clockInAt), worked: formatMinutes(open.workedMinutes) })}
        </span>
      </button>
      <Modal
        open={confirmOut}
        onClose={() => setConfirmOut(false)}
        title={t('clock.clockOutTitle')}
        description={t('clock.clockOutHint', { worked: formatMinutes(open.workedMinutes) })}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOut(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button variant="primary" loading={clockOut.isPending} onClick={() => void doClockOut()}>
              {t('clock.clockOut')}
            </Button>
          </>
        }
      >
        {clockOut.isError && <Alert>{staffErrorMessage(clockOut.error, t)}</Alert>}
        <FormField label={t('clock.breakMinutes')}>
          <Input type="number" inputMode="numeric" min={0} value={breakMinutes} onChange={(event) => setBreakMinutes(event.target.value)} />
        </FormField>
      </Modal>
    </>
  );
}
