import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { sharedDeviceFlag } from '@/features/shared-device/model/shared-device';
import { ROUTES } from '@/shared/constants/routes';
import { useAuth } from '@/shared/hooks/use-auth';
import styles from './TopbarTrigger.module.css';

/**
 * Shared device (F6): ends the current session (refresh token revoked) and returns to the PIN lock screen.
 * Rendered only on browsers registered as a shared device (UX hint; the server enforces the device cookie).
 */
export function SwitchUserButton() {
  const { t } = useTranslation('staff');
  const navigate = useNavigate();
  const { logout } = useAuth();
  if (!sharedDeviceFlag.isSet()) return null;

  return (
    <button
      type="button"
      className={styles.trigger}
      onClick={() => void logout().then(() => navigate(ROUTES.device, { replace: true }))}
    >
      <Users aria-hidden="true" />
      <span className={styles.label}>{t('lock.switchUser')}</span>
    </button>
  );
}
