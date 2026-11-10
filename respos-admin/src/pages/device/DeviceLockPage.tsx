import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { sharedDeviceFlag, useCurrentDevice, useDeviceStaff } from '@/features/shared-device/model/shared-device';
import { PinPad } from '@/features/shared-device/ui/PinPad';
import styles from '@/features/shared-device/ui/shared-device.module.css';
import { initials, staffErrorMessage } from '@/features/staff/model/staff-errors';
import type { DeviceStaffDto } from '@/entities/staff/staff.types';
import { ROUTES } from '@/shared/constants/routes';
import { useAuth } from '@/shared/hooks/use-auth';
import { Alert, Button, EmptyState, ErrorState, PageLoader } from '@/shared/ui';

/** Shared-device lock screen: avatar grid of the branch's PIN-enabled staff + large numeric keypad (ADR-0014). */
export function DeviceLockPage() {
  const { t } = useTranslation('staff');
  const navigate = useNavigate();
  const { status, pinLogin } = useAuth();
  const device = useCurrentDevice();
  const staff = useDeviceStaff(Boolean(device.data) && status === 'unauthenticated');
  const [selected, setSelected] = useState<DeviceStaffDto | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (status === 'loading' || device.isLoading) return <PageLoader />;
  if (status === 'authenticated') return <Navigate to={ROUTES.home} replace />;
  if (device.isError) return <ErrorState error={device.error} onRetry={() => void device.refetch()} />;
  if (!device.data) {
    // Not (or no longer) a shared device: drop the UX hint synchronously so /login does not bounce back here.
    sharedDeviceFlag.clear();
    return <Navigate to={ROUTES.login} replace />;
  }

  const choose = (person: DeviceStaffDto | null) => {
    setSelected(person);
    setPin('');
    setError(null);
  };

  const submit = async () => {
    if (!selected || pending) return;
    setPending(true);
    setError(null);
    try {
      await pinLogin({ userId: selected.id, pin });
      navigate(ROUTES.home, { replace: true });
    } catch (caught) {
      setPin('');
      setError(staffErrorMessage(caught, t));
    } finally {
      setPending(false);
    }
  };

  return (
    <main className={styles.screen} id="main-content">
      <header className={styles.header}>
        <h1 className={styles.title}>{selected ? selected.fullName : t('lock.title')}</h1>
        <p className={styles.subtitle}>
          {device.data.organizationName} · {device.data.branchName} · {device.data.name}
        </p>
      </header>
      {error && <Alert>{error}</Alert>}
      {selected ? (
        <div className={styles.panel}>
          <PinPad value={pin} onChange={setPin} onSubmit={() => void submit()} disabled={pending} />
          <Button variant="ghost" onClick={() => choose(null)}>
            {t('lock.back')}
          </Button>
        </div>
      ) : staff.isError ? (
        <ErrorState error={staff.error} onRetry={() => void staff.refetch()} />
      ) : staff.data && staff.data.length === 0 ? (
        <EmptyState title={t('lock.noStaff')} description={t('lock.noStaffHint')} />
      ) : (
        <ul className={styles.grid} aria-label={t('lock.chooseUser')}>
          {(staff.data ?? []).map((person) => (
            <li key={person.id}>
              <button type="button" className={styles.avatar} onClick={() => choose(person)}>
                <span className={styles.initials} aria-hidden="true">
                  {initials(person.fullName)}
                </span>
                <span className={styles.name}>{person.fullName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <nav className={styles.links} aria-label={t('lock.other')}>
        <Link to={`${ROUTES.login}?password=1`}>{t('lock.passwordLogin')}</Link>
      </nav>
    </main>
  );
}
