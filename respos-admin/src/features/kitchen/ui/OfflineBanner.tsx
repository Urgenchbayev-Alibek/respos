import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ConnectionState } from '@/shared/realtime';
import styles from './OfflineBanner.module.css';

/** Red strip when the realtime link is down: the board may be stale (it still polls REST). */
export function OfflineBanner({ state }: { state: ConnectionState }) {
  const { t } = useTranslation('kitchen');
  if (state === 'connected' || state === 'connecting') return null;
  return (
    <div className={styles.banner} role="alert">
      <WifiOff aria-hidden="true" />
      <span>{t(state === 'reconnecting' ? 'offline.reconnecting' : 'offline.disconnected')}</span>
    </div>
  );
}
