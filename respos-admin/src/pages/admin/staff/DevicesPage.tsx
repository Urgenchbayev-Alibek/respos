import { MonitorSmartphone } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDevices, useRevokeDevice } from '@/entities/staff/staff.queries';
import type { DeviceDto } from '@/entities/staff/staff.types';
import { sharedDeviceFlag, useForgetDevice } from '@/features/shared-device/model/shared-device';
import { staffErrorMessage } from '@/features/staff/model/staff-errors';
import { RegisterDeviceModal } from '@/features/staff/ui/PinModals';
import { ROUTES } from '@/shared/constants/routes';
import { useAuth } from '@/shared/hooks/use-auth';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Alert, Button, Card, Checkbox, ConfirmDialog, DataTable, PageHeader, StatusBadge, Toolbar, useToast, type DataTableColumn } from '@/shared/ui';
import { StaffTabs } from './StaffTabs';

/** Admin → Staff → shared devices of the branch (PIN quick login): register this browser, list, revoke. */
export function DevicesPage() {
  const { t } = useTranslation('staff');
  const format = useFormatters();
  const toast = useToast();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [includeRevoked, setIncludeRevoked] = useState(false);
  const devices = useDevices(includeRevoked);
  const revoke = useRevokeDevice();
  const forget = useForgetDevice();
  const [registering, setRegistering] = useState(false);
  const [revoking, setRevoking] = useState<DeviceDto | null>(null);
  const isSharedDevice = sharedDeviceFlag.isSet();

  const columns = useMemo<DataTableColumn<DeviceDto>[]>(
    () => [
      { key: 'name', header: t('devices.name'), cell: (d) => d.name },
      {
        key: 'state',
        header: t('devices.state'),
        cell: (d) =>
          d.isActive ? (
            <StatusBadge tone={d.lockedUntil ? 'warning' : 'success'}>{d.lockedUntil ? t('devices.locked') : t('devices.active')}</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">{t('devices.revoked')}</StatusBadge>
          ),
      },
      { key: 'created', header: t('devices.created'), hideOnMobile: true, cell: (d) => `${format.dateTime(d.createdAt)} · ${d.createdByName ?? '—'}` },
      { key: 'used', header: t('devices.lastUsed'), cell: (d) => (d.lastUsedAt ? format.dateTime(d.lastUsedAt) : '—') },
      { key: 'expires', header: t('devices.expires'), hideOnMobile: true, cell: (d) => format.date(d.expiresAt) },
      {
        key: 'actions',
        header: t('fields.actions'),
        align: 'right',
        cell: (d) =>
          d.isActive && (
            <Button size="sm" variant="danger" onClick={() => setRevoking(d)}>
              {t('devices.revoke')}
            </Button>
          ),
      },
    ],
    [t, format],
  );

  const confirmRevoke = async () => {
    if (!revoking) return;
    try {
      await revoke.mutateAsync(revoking.id);
      toast.success(t('devices.revokedToast'));
    } catch (error) {
      toast.error(staffErrorMessage(error, t));
    }
    setRevoking(null);
  };

  const exitSharedMode = async () => {
    try {
      await forget.mutateAsync();
      toast.success(t('devices.forgotten'));
    } catch (error) {
      toast.error(staffErrorMessage(error, t));
    }
  };

  /** After registration the manager's session ends; staff sign in with PIN on the lock screen. */
  const onRegistered = async () => {
    setRegistering(false);
    await logout();
    navigate(ROUTES.device, { replace: true });
  };

  return (
    <>
      <PageHeader
        title={t('nav.title')}
        description={t('devices.subtitle')}
        actions={
          !isSharedDevice && (
            <Button variant="primary" icon={<MonitorSmartphone />} onClick={() => setRegistering(true)}>
              {t('devices.registerThis')}
            </Button>
          )
        }
      />
      <StaffTabs />
      {isSharedDevice && (
        <Card>
          <Alert tone="success">{t('devices.thisIsShared')}</Alert>
          <Button variant="secondary" loading={forget.isPending} onClick={() => void exitSharedMode()}>
            {t('devices.exitShared')}
          </Button>
        </Card>
      )}
      <Toolbar>
        <Checkbox label={t('devices.showRevoked')} checked={includeRevoked} onChange={(e) => setIncludeRevoked(e.target.checked)} />
      </Toolbar>
      <DataTable
        caption={t('tabs.devices')}
        columns={columns}
        rows={devices.data}
        getRowId={(d) => d.id}
        isLoading={devices.isFetching}
        error={devices.error}
        onRetry={() => void devices.refetch()}
        emptyTitle={t('devices.empty')}
      />
      {registering && <RegisterDeviceModal onClose={() => setRegistering(false)} onRegistered={() => void onRegistered()} />}
      <ConfirmDialog
        open={Boolean(revoking)}
        danger
        title={t('devices.revokeTitle', { name: revoking?.name ?? '' })}
        message={t('devices.revokeMessage')}
        confirmLabel={t('devices.revoke')}
        loading={revoke.isPending}
        onConfirm={() => void confirmRevoke()}
        onCancel={() => setRevoking(null)}
      />
    </>
  );
}
