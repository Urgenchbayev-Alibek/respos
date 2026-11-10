import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/shared/ui';
import styles from './pwa.module.css';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Registers the service worker (production build only) and asks before activating a new version,
 * so a cashier is never reloaded in the middle of a payment.
 */
export function PwaUpdatePrompt() {
  const { t } = useTranslation('ux');
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => void registration.update(), UPDATE_CHECK_MS);
    },
    onRegisterError(error: unknown) {
      console.warn('[pwa] service worker registration failed', error);
    },
  });

  if (!needRefresh) return null;
  return (
    <div className={styles.prompt} role="status" aria-live="polite">
      <div>
        <p className={styles.title}>{t('pwa.updateTitle')}</p>
        <p className={styles.description}>{t('pwa.updateDescription')}</p>
      </div>
      <div className={styles.actions}>
        <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
          {t('pwa.later')}
        </Button>
        <Button size="sm" variant="primary" icon={<RefreshCw />} onClick={() => void updateServiceWorker(true)}>
          {t('pwa.update')}
        </Button>
      </div>
    </div>
  );
}
