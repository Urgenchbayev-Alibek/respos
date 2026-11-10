import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/shared/api/client';
import { fetchPublicMenu, type PublicMenu } from '@/shared/api/publicMenuApi';

export type PublicMenuState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error' }
  | { status: 'ready'; menu: PublicMenu };

const LOADING: PublicMenuState = { status: 'loading' };

/** Loads the public menu of a branch; 404 is a distinct state (wrong / outdated QR code). */
export function usePublicMenu(slug: string): { state: PublicMenuState; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${slug}#${attempt}`;
  const [result, setResult] = useState<{ key: string; state: PublicMenuState } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicMenu(slug, controller.signal)
      .then((menu) => setResult({ key: requestKey, state: { status: 'ready', menu } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const status = error instanceof ApiError && error.status === 404 ? 'not-found' : 'error';
        setResult({ key: requestKey, state: { status } });
      });
    return () => controller.abort();
  }, [slug, requestKey]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { state: result?.key === requestKey ? result.state : LOADING, retry };
}
