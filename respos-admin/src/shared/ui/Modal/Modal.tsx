import clsx from 'clsx';
import { X } from 'lucide-react';
import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../IconButton/IconButton';
import styles from './Modal.module.css';
import { useDialogBehavior } from './use-dialog';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons row; put the primary action last. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Prevent closing by overlay click (e.g. while a request is running). */
  dismissible?: boolean;
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissible = true }: ModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => {
    if (dismissible) onClose();
  };
  useDialogBehavior(open, panelRef, close);

  if (!open) return null;
  return createPortal(
    <div className={styles.overlay} onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={clsx(styles.panel, styles[size])}
      >
        <header className={styles.header}>
          <div>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            )}
          </div>
          <IconButton label={t('common:actions.close')} icon={<X />} onClick={close} disabled={!dismissible} />
        </header>
        {children && <div className={styles.body}>{children}</div>}
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
