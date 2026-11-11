import { useEffect, useState, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { PRINT_BODY_ATTRIBUTE, requestedPrintId, subscribePrintLayout } from './print-controller';
import styles from './PrintArea.module.css';

export interface PrintAreaProps {
  /** Unique id; print it with `printArea(id)`. */
  id: string;
  /** Also print this area on a plain page print (Ctrl+P, `printPage()`) while it is mounted (e.g. an open pre-check). */
  defaultForPrint?: boolean;
  children: ReactNode;
}

/**
 * 80 mm thermal print layout. Renders nothing on screen; while its print job runs, the content is portalled
 * to `<body>` and everything else is hidden (`@page thermal { size: 80mm auto; margin: 0 }`), black on white.
 */
export function PrintArea({ id, defaultForPrint = false, children }: PrintAreaProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const releaseBody = () => {
      if (document.body.getAttribute(PRINT_BODY_ATTRIBUTE) === id) document.body.removeAttribute(PRINT_BODY_ATTRIBUTE);
    };
    const unsubscribe = subscribePrintLayout({
      onBegin: () => {
        const requested = requestedPrintId();
        if (requested !== id && !(requested === null && defaultForPrint)) return;
        document.body.setAttribute(PRINT_BODY_ATTRIBUTE, id);
        // The page is captured right after the job starts: render synchronously.
        flushSync(() => setActive(true));
      },
      onEnd: () => {
        setActive(false);
        releaseBody();
      },
    });
    return () => {
      unsubscribe();
      releaseBody();
    };
  }, [id, defaultForPrint]);

  if (!active) return null;
  return createPortal(
    <div className={styles.root} data-print-area={id}>
      {children}
    </div>,
    document.body,
  );
}

/** Two-column row for receipts/reports: label left, value right. */
export function PrintRow({ label, value, strong = false }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={strong ? `${styles.row} ${styles.strong}` : styles.row}>
      <span>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}

/** Dashed separator line. */
export function PrintDivider() {
  return <hr className={styles.divider} />;
}
