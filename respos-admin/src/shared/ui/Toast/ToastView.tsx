import clsx from 'clsx';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { ToastInput, ToastTone } from './toast-context';
import styles from './Toast.module.css';

export interface ToastItem extends Required<Omit<ToastInput, 'description'>> {
  id: number;
  description?: string;
  /** Set by dismiss: the toast plays its exit, then asks to be removed. */
  closing?: boolean;
}

const ICONS: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 />,
  error: <AlertCircle />,
  info: <Info />,
  warning: <TriangleAlert />,
};

interface ToastViewProps {
  toast: ToastItem;
  closeLabel: string;
  onDismiss: (id: number) => void;
  /** Called once the exit transition has finished (synchronously where transitions do not run). */
  onExited: (id: number) => void;
}

export function ToastView({ toast, closeLabel, onDismiss, onExited }: ToastViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { id, closing } = toast;

  useLayoutEffect(() => {
    if (!closing) return undefined;
    const running = ref.current?.getAnimations?.() ?? [];
    if (running.length === 0) {
      onExited(id);
      return undefined;
    }
    let cancelled = false;
    void Promise.allSettled(running.map((animation) => animation.finished)).then(() => {
      if (!cancelled) onExited(id);
    });
    return () => {
      cancelled = true;
    };
  }, [closing, id, onExited]);

  return (
    <div
      ref={ref}
      className={clsx(styles.toast, styles[toast.tone])}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      data-closing={closing || undefined}
    >
      <span className={styles.icon}>{ICONS[toast.tone]}</span>
      <div className={styles.content}>
        <p className={styles.title}>{toast.title}</p>
        {toast.description && <p className={styles.description}>{toast.description}</p>}
      </div>
      <button type="button" className={styles.close} aria-label={closeLabel} onClick={() => onDismiss(id)}>
        <X />
      </button>
    </div>
  );
}
