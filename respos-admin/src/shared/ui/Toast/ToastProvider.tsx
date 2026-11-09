import clsx from 'clsx';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ToastContext, type ToastApi, type ToastInput, type ToastTone } from './toast-context';
import styles from './Toast.module.css';

interface ToastItem extends Required<Omit<ToastInput, 'description'>> {
  id: number;
  description?: string;
}

const DEFAULT_DURATION_MS = 5000;
const MAX_VISIBLE = 4;
const ICONS: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 />,
  error: <AlertCircle />,
  info: <Info />,
  warning: <TriangleAlert />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      const toast: ToastItem = { id, tone: 'info', duration: DEFAULT_DURATION_MS, ...input };
      setToasts((list) => [...list.slice(-(MAX_VISIBLE - 1)), toast]);
      if (toast.duration > 0) setTimeout(() => dismiss(id), toast.duration);
    },
    [dismiss],
  );

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
        <div className={styles.region} aria-live="polite" aria-relevant="additions">
          {toasts.map((toast) => (
            <div key={toast.id} className={clsx(styles.toast, styles[toast.tone])} role={toast.tone === 'error' ? 'alert' : 'status'}>
              <span className={styles.icon}>{ICONS[toast.tone]}</span>
              <div className={styles.content}>
                <p className={styles.title}>{toast.title}</p>
                {toast.description && <p className={styles.description}>{toast.description}</p>}
              </div>
              <button type="button" className={styles.close} aria-label={t('common:actions.close')} onClick={() => dismiss(toast.id)}>
                <X />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
