import type { WebContents, WebContentsPrintOptions } from 'electron';
import type { PrinterInfo, PrintOptions, PrintPaper, PrintResult } from '../shared/ipc';
import type { DesktopSettings } from '../shared/settings-schema';
import type { Logger } from './logger';

const MICRONS_PER_MM = 1000;
const MICRONS_PER_CSS_PX = 25_400 / 96;
const RECEIPT_WIDTH_MICRONS = 80 * MICRONS_PER_MM;
/** Used when the layout height cannot be measured. */
const RECEIPT_FALLBACK_HEIGHT_MICRONS = 297 * MICRONS_PER_MM;
const RECEIPT_MIN_HEIGHT_MICRONS = 40 * MICRONS_PER_MM;
const RECEIPT_MAX_HEIGHT_MICRONS = 3000 * MICRONS_PER_MM;
/** Keeps the last line off a second page when the printer driver rounds the page height down. */
const RECEIPT_TAIL_MICRONS = 3 * MICRONS_PER_MM;

/** Bottom edge (CSS px) of what is laid out for print: the lowest visible direct child of <body>. */
const MEASURE_PRINT_HEIGHT = `(() => {
  let bottom = 0;
  for (const element of document.body.children) {
    const rect = element.getBoundingClientRect();
    if (rect.height > 0) bottom = Math.max(bottom, rect.bottom + window.scrollY);
  }
  return bottom;
})()`;

/** One job as it is handed to the printer: what the web app asked for and what Electron is told to do. */
export interface PrintJob {
  paper: PrintPaper;
  options: WebContentsPrintOptions;
}

export interface PrintJobOutcome {
  success: boolean;
  reason: string;
}

/** Where a prepared job goes: the real printer (`sendToPrinter`) or, in end-to-end runs, a capture file. */
export type PrintSink = (contents: WebContents, job: PrintJob) => Promise<PrintJobOutcome>;

export async function listPrinters(contents: WebContents): Promise<PrinterInfo[]> {
  const printers = await contents.getPrintersAsync();
  return printers.map((printer) => ({ name: printer.name, displayName: printer.displayName || printer.name }));
}

/**
 * A receipt printer feeds exactly one page per job, so the page must be as tall as the receipt. The page is
 * laid out for print (DevTools protocol media emulation, a few milliseconds) and measured. `null` when that is
 * not possible (DevTools are open on the window) — the caller then uses a fixed page height.
 */
async function measureReceiptHeight(contents: WebContents, log: Logger): Promise<number | null> {
  const protocol = contents.debugger;
  if (protocol.isAttached()) return null;
  try {
    protocol.attach('1.3');
    await protocol.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });
    const evaluation = (await protocol.sendCommand('Runtime.evaluate', {
      expression: MEASURE_PRINT_HEIGHT,
      returnByValue: true,
    })) as { result?: { value?: unknown } };
    const pixels = evaluation.result?.value;
    if (typeof pixels !== 'number' || !Number.isFinite(pixels) || pixels <= 0) return null;
    const microns = Math.ceil(pixels * MICRONS_PER_CSS_PX) + RECEIPT_TAIL_MICRONS;
    return Math.min(RECEIPT_MAX_HEIGHT_MICRONS, Math.max(RECEIPT_MIN_HEIGHT_MICRONS, microns));
  } catch (error) {
    log('warn', `receipt height could not be measured: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  } finally {
    // Detaching also drops the print-media emulation.
    if (protocol.isAttached()) protocol.detach();
  }
}

export const sendToPrinter: PrintSink = (contents, job) =>
  new Promise((resolve) => {
    try {
      contents.print(job.options, (success, failureReason) => resolve({ success, reason: failureReason }));
    } catch (error) {
      resolve({ success: false, reason: error instanceof Error ? error.message : String(error) });
    }
  });

/**
 * Prints the page the web app has already laid out for print.
 * - `receipt-80mm` with silent printing enabled and a printer chosen → straight to that printer on an 80 mm
 *   page; any failure is reported as `{ ok: false }` so the web app can fall back to the print dialog.
 * - otherwise (silent printing off, no printer, or an `a4` job, which never goes to the receipt printer) →
 *   the system print dialog. Closing that dialog is the user's decision, not a failure.
 */
export async function printPage(
  contents: WebContents,
  options: PrintOptions,
  settings: Pick<DesktopSettings, 'printer' | 'silentPrint'>,
  log: Logger,
  sink: PrintSink = sendToPrinter,
): Promise<PrintResult> {
  const paper = options.paper ?? 'a4';
  const printerName = settings.printer;

  if (paper === 'receipt-80mm' && settings.silentPrint && printerName !== null) {
    const printers = await contents.getPrintersAsync();
    if (!printers.some((printer) => printer.name === printerName)) {
      log('warn', 'silent print skipped: the configured printer is not installed');
      return { ok: false, reason: 'printer_not_found' };
    }
    const height = (await measureReceiptHeight(contents, log)) ?? RECEIPT_FALLBACK_HEIGHT_MICRONS;
    const job = await sink(contents, {
      paper,
      options: {
        silent: true,
        deviceName: printerName,
        margins: { marginType: 'none' },
        pageSize: { width: RECEIPT_WIDTH_MICRONS, height },
        printBackground: false,
      },
    });
    if (job.success) return { ok: true };
    log('warn', `silent print failed: ${job.reason}`);
    return { ok: false, reason: job.reason || 'print_failed' };
  }

  const dialogJob = await sink(contents, {
    paper,
    options: {
      silent: false,
      printBackground: false,
      ...(paper === 'a4' ? { pageSize: 'A4' as const } : { margins: { marginType: 'none' as const } }),
    },
  });
  if (dialogJob.success || /cancel/i.test(dialogJob.reason)) return { ok: true };
  log('warn', `print failed: ${dialogJob.reason}`);
  return { ok: false, reason: dialogJob.reason || 'print_failed' };
}
