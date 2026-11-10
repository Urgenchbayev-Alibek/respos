import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useResetMemberPin, useStaffMembers } from '@/entities/staff/staff.queries';
import type { StaffMemberDto } from '@/entities/staff/staff.types';
import { staffErrorMessage } from '@/features/staff/model/staff-errors';
import { MemberPinModal } from '@/features/staff/ui/PinModals';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Button, ConfirmDialog, DataTable, PageHeader, StatusBadge, useToast, type DataTableColumn } from '@/shared/ui';
import { StaffTabs } from './StaffTabs';

/** Admin → Staff → employees of the branch: PIN status, set / reset PIN (owner/admin never get a PIN). */
export function StaffMembersPage() {
  const { t } = useTranslation('staff');
  const format = useFormatters();
  const toast = useToast();
  const members = useStaffMembers();
  const reset = useResetMemberPin();
  const [pinFor, setPinFor] = useState<StaffMemberDto | null>(null);
  const [resetFor, setResetFor] = useState<StaffMemberDto | null>(null);

  const columns = useMemo<DataTableColumn<StaffMemberDto>[]>(
    () => [
      { key: 'name', header: t('fields.employee'), cell: (m) => m.fullName },
      { key: 'email', header: t('fields.email'), hideOnMobile: true, cell: (m) => m.email },
      { key: 'roles', header: t('fields.roles'), hideOnMobile: true, cell: (m) => m.roles.map((r) => t(`roles.${r}`, { defaultValue: r })).join(', ') },
      {
        key: 'pin',
        header: t('members.pin'),
        cell: (m) =>
          !m.pinAllowed ? (
            <StatusBadge tone="neutral">{t('members.pinNotAllowed')}</StatusBadge>
          ) : m.pinLockedUntil ? (
            <StatusBadge tone="danger">{t('members.pinLocked', { time: format.time(m.pinLockedUntil) })}</StatusBadge>
          ) : m.hasPin ? (
            <StatusBadge tone="success">{t('members.pinSet')}</StatusBadge>
          ) : (
            <StatusBadge tone="warning">{t('members.pinMissing')}</StatusBadge>
          ),
      },
      {
        key: 'actions',
        header: t('fields.actions'),
        align: 'right',
        cell: (m) =>
          m.pinAllowed && (
            <>
              <Button size="sm" onClick={() => setPinFor(m)}>
                {t('members.setPin')}
              </Button>{' '}
              {m.hasPin && (
                <Button size="sm" variant="ghost" onClick={() => setResetFor(m)}>
                  {t('members.resetPin')}
                </Button>
              )}
            </>
          ),
      },
    ],
    [t, format],
  );

  const confirmReset = async () => {
    if (!resetFor) return;
    try {
      await reset.mutateAsync(resetFor.userId);
      toast.success(t('members.pinReset'));
    } catch (error) {
      toast.error(staffErrorMessage(error, t));
    }
    setResetFor(null);
  };

  return (
    <>
      <PageHeader title={t('nav.title')} description={t('members.subtitle')} />
      <StaffTabs />
      <DataTable
        caption={t('tabs.members')}
        columns={columns}
        rows={members.data}
        getRowId={(m) => m.userId}
        isLoading={members.isFetching}
        error={members.error}
        onRetry={() => void members.refetch()}
        emptyTitle={t('schedule.noMembers')}
      />
      {pinFor && <MemberPinModal member={pinFor} onClose={() => setPinFor(null)} />}
      <ConfirmDialog
        open={Boolean(resetFor)}
        danger
        title={t('members.resetPinTitle', { name: resetFor?.fullName ?? '' })}
        message={t('members.resetPinMessage')}
        confirmLabel={t('members.resetPin')}
        loading={reset.isPending}
        onConfirm={() => void confirmReset()}
        onCancel={() => setResetFor(null)}
      />
    </>
  );
}
