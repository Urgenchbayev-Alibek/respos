import { useCallback, useEffect, useState } from 'react';

/** Fullscreen API state + toggle for the whole document (KDS, waiter tablets). */
export function useFullscreen(): { supported: boolean; fullscreen: boolean; toggle: () => void } {
  const supported = typeof document !== 'undefined' && typeof document.documentElement.requestFullscreen === 'function';
  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = useCallback(() => {
    const action = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    void action?.catch((error: unknown) => console.warn('[ui] fullscreen toggle failed', error));
  }, []);

  return { supported, fullscreen, toggle };
}
