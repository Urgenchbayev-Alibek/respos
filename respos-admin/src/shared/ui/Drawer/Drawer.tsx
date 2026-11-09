import clsx from 'clsx';
import { X } from 'lucide-react';
import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../IconButton/IconButton';
import { useDialogBehavior } from '../Modal/use-dialog';
import styles from './Drawer.module.css';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  side?: 'left' | 'right';
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
  /** Hide the header (e.g. mobile navigation provides its own). */
  hideHeader?: boolean;
}

export function Drawer({ open, onClose, title, side = 'right', width = 420, children, footer, hideHeader }: DrawerProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehavior(open, panelRef, onClose);

  if (!open) return null;
  return createPortal(
    <div className={styles.overlay} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hideHeader ? undefined : titleId}
        aria-label={hideHeader && typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={clsx(styles.panel, styles[side])}
        style={{ width: `min(${width}px, 100vw)` }}
      >
        {!hideHeader && (
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <IconButton label={t('common:actions.close')} icon={<X />} onClick={onClose} />
          </header>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
