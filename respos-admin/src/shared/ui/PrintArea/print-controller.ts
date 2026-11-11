import { getDesktopApi } from '@/shared/lib/desktop';
import type { ResposDesktopApi } from '@/shared/types/desktop';

/**
 * The single print entry point. A print job applies the print layout (the requested `<PrintArea>` renders its
 * content), prints, then releases the layout:
 * - browser: `window.print()`; the layout follows the native `beforeprint` / `afterprint` events (Ctrl+P too);
 * - desktop shell: `window.resposDesktop.print()` (silent to the configured printer when enabled). The layout is
 *   applied before the call and released only when its promise settles; `{ ok: false }` or a rejected call
 *   falls back to the browser dialog. Desktop jobs run one at a time, in the order they were requested.
 */

/** Attribute on `<body>` while a thermal print job runs: hides the app, shows only the print area. */
export const PRINT_BODY_ATTRIBUTE = 'data-print-thermal';

export type PrintPaper = 'receipt-80mm' | 'a4';

export interface PrintLayoutListener {
  /** A print job starts: render the print content synchronously (the page is captured right after). */
  onBegin: () => void;
  /** The print job is over: restore the screen layout. */
  onEnd: () => void;
}

const listeners = new Set<PrintLayoutListener>();
let requestedId: string | null = null;
let desktopJobActive = false;
let desktopQueue: Promise<void> = Promise.resolve();
let wired = false;

function beginLayout(): void {
  listeners.forEach((listener) => listener.onBegin());
}

function endLayout(): void {
  listeners.forEach((listener) => listener.onEnd());
  requestedId = null;
}

function onAfterPrint(): void {
  // The shell's own print job fires `afterprint` as well; a desktop job keeps its layout until the promise settles.
  if (desktopJobActive) return;
  endLayout();
}

function wireBrowserEvents(): void {
  if (wired) return;
  wired = true;
  window.addEventListener('beforeprint', beginLayout);
  window.addEventListener('afterprint', onAfterPrint);
}

/** Which `<PrintArea id>` the running print job is for; `null` = a plain page print. */
export function requestedPrintId(): string | null {
  return requestedId;
}

/** `<PrintArea>` registers here to render on a print job and to hide again afterwards. Returns the unsubscribe. */
export function subscribePrintLayout(listener: PrintLayoutListener): () => void {
  wireBrowserEvents();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function printInBrowser(id: string | null): void {
  requestedId = id;
  window.print();
}

async function printOnDesktop(desktop: ResposDesktopApi, id: string | null, paper: PrintPaper): Promise<void> {
  requestedId = id;
  desktopJobActive = true;
  let printed = false;
  try {
    beginLayout();
    const result = await desktop.print({ paper });
    printed = result.ok;
    if (!result.ok) console.warn(`[print] desktop print failed (${result.reason}); opening the print dialog`);
  } catch (error) {
    console.warn('[print] desktop print bridge failed; opening the print dialog', error);
  } finally {
    desktopJobActive = false;
    endLayout();
  }
  if (!printed) printInBrowser(id);
}

function runPrintJob(id: string | null, paper: PrintPaper): void {
  wireBrowserEvents();
  const desktop = getDesktopApi();
  if (!desktop) {
    printInBrowser(id);
    return;
  }
  desktopQueue = desktopQueue
    .then(() => printOnDesktop(desktop, id, paper))
    .catch((error: unknown) => console.error('[print] print job failed', error));
}

/** Print one `<PrintArea id={id}>` (80 mm thermal layout). */
export function printArea(id: string): void {
  runPrintJob(id, 'receipt-80mm');
}

/** Print the page as it is laid out for `@media print` (A4 sheets such as the table QR cards). */
export function printPage(paper: PrintPaper = 'a4'): void {
  runPrintJob(null, paper);
}
