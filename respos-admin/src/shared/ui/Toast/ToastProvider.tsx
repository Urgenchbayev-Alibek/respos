import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ToastContext, type ToastApi, type ToastInput } from './toast-context';
import styles from './Toast.module.css';
import { ToastView, type ToastItem } from './ToastView';
import { useStackFlip } from './use-stack-flip';

interface ToastTimer {
  handle: ReturnType<typeof setTimeout> | null;
  remaining: number;
  startedAt: number;
}

type PauseReason = 'pointer' | 'focus' | 'hidden';

const DEFAULT_DURATION_MS = 5000;
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ToastTimer>());
  const pauseReasons = useRef(new Set<PauseReason>());
  const regionRef = useRef<HTMLDivElement>(null);
  /** Ids still on screen and not leaving, oldest first. */
  const liveIds = useRef<number[]>([]);
  const dismissRef = useRef<(id: number) => void>(() => undefined);

  const pauseAll = useCallback(() => {
    const now = Date.now();
    timers.current.forEach((timer) => {
      if (timer.handle === null) return;
      clearTimeout(timer.handle);
      timer.handle = null;
      timer.remaining = Math.max(0, timer.remaining - (now - timer.startedAt));
    });
  }, []);

  const resumeAll = useCallback(() => {
    timers.current.forEach((timer, id) => {
      if (timer.handle !== null) return;
      timer.startedAt = Date.now();
      timer.handle = setTimeout(() => dismissRef.current(id), timer.remaining);
    });
  }, []);

  /** Auto-dismiss waits while the stack is hovered or focused, or the tab is hidden (ACCESSIBILITY.md, section 8). */
  const pause = useCallback(
    (reason: PauseReason) => {
      if (pauseReasons.current.size === 0) pauseAll();
      pauseReasons.current.add(reason);
    },
    [pauseAll],
  );

  const resume = useCallback(
    (...reasons: PauseReason[]) => {
      if (pauseReasons.current.size === 0) return;
      reasons.forEach((reason) => pauseReasons.current.delete(reason));
      if (pauseReasons.current.size === 0) resumeAll();
    },
    [resumeAll],
  );

  const remove = useCallback((id: number) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer?.handle != null) clearTimeout(timer.handle);
    timers.current.delete(id);
    liveIds.current = liveIds.current.filter((liveId) => liveId !== id);
    setToasts((list) => list.map((toast) => (toast.id === id ? { ...toast, closing: true } : toast)));
  }, []);
  dismissRef.current = dismiss;

  const show = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    const toast: ToastItem = { id, tone: 'info', duration: DEFAULT_DURATION_MS, ...input };
    setToasts((list) => [...list, toast]);
    liveIds.current.push(id);
    if (toast.duration > 0) {
      const paused = pauseReasons.current.size > 0;
      const handle = paused ? null : setTimeout(() => dismissRef.current(id), toast.duration);
      timers.current.set(id, { handle, remaining: toast.duration, startedAt: Date.now() });
    }
    // The oldest toasts make room through the normal exit, which also drops their timers.
    liveIds.current.slice(0, -MAX_VISIBLE).forEach((evicted) => dismissRef.current(evicted));
  }, []);

  /**
   * A removed toast fires no blur, and an emptied stack no pointerleave, so those holds are released here,
   * but only once they are really gone: closing one toast must not restart the others under the pointer.
   */
  useLayoutEffect(() => {
    const region = regionRef.current;
    if (toasts.length === 0) resume('pointer', 'focus');
    else if (!region?.contains(document.activeElement)) resume('focus');
  }, [toasts, resume]);

  const ids = useMemo(() => toasts.map((toast) => toast.id), [toasts]);
  useStackFlip(regionRef, ids);

  useEffect(() => {
    const onVisibilityChange = () => (document.hidden ? pause('hidden') : resume('hidden'));
    document.addEventListener('visibilitychange', onVisibilityChange);
    const registered = timers.current;
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      registered.forEach((timer) => {
        if (timer.handle !== null) clearTimeout(timer.handle);
      });
      registered.clear();
    };
  }, [pause, resume]);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show({ title, description, tone: 'success' }),
      error: (title, description) => show({ title, description, tone: 'error', duration: 8000 }),
      info: (title, description) => show({ title, description, tone: 'info' }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          ref={regionRef}
          className={styles.region}
          aria-live="polite"
          aria-relevant="additions"
          onPointerEnter={() => pause('pointer')}
          onPointerLeave={() => resume('pointer')}
          onFocus={() => pause('focus')}
          onBlur={() => resume('focus')}
        >
          {toasts.map((toast) => (
            <ToastView
              key={toast.id}
              toast={toast}
              closeLabel={t('common:actions.close')}
              onDismiss={dismiss}
              onExited={remove}
            />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
