import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { sessionStore } from '@/shared/api/session-store';
import { useToast } from '@/shared/ui';

const RETRY_TOAST_MS = 8_000;

/** Non-blocking toast while the session refresh retries (429/5xx/network); the user stays signed in. */
export function ConnectionToast() {
  const { t } = useTranslation('errors');
  const toast = useToast();
  useEffect(
    () =>
      sessionStore.onConnectionChange((online) => {
        if (online) toast.success(t('network.restored'));
        else toast.show({ title: t('network.offline'), description: t('network.retrying'), tone: 'warning', duration: RETRY_TOAST_MS });
      }),
    [t, toast],
  );
  return null;
}
