import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from '@/shared/hooks/use-online-status';
import styles from './pwa.module.css';

/** App-wide strip while the device has no network. The app shell is cached by the service worker; data is not. */
export function OfflineBanner() {
  const { t } = useTranslation('ux');
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className={styles.offline} role="alert">
      <WifiOff aria-hidden="true" />
      <span>{t('pwa.offline')}</span>
    </div>
  );
}
