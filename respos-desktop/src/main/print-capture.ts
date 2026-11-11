import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Logger } from './logger';
import type { PrintSink } from './printing';

/** One line of the capture file. */
export interface CapturedPrintJob {
  /** ISO time the job reached the main process. */
  at: string;
  paper: string;
  silent: boolean;
  /** System name of the target printer; `null` when the job would have opened the print dialog. */
  deviceName: string | null;
  /** `'A4'`, or `{ width, height }` in microns for a receipt. */
  pageSize: unknown;
  /** Path of the page that was printed (no origin, no query). */
  page: string;
}

function pagePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}

/**
 * Test hook (`RESPOS_DESKTOP_PRINT_CAPTURE=<file>`, end-to-end runs only, never set for users): every print
 * job that would go to a printer or open the print dialog is appended to `file` as one JSON line and reported
 * as printed. Everything before that point — the bridge, IPC validation, the choice between silent printing
 * and the dialog, the receipt height measurement — runs exactly as in production.
 */
export function createPrintCapture(file: string, log: Logger): PrintSink {
  const target = path.resolve(file);
  log('warn', 'print capture is ON: print jobs are written to a file and never reach a printer');
  return async (contents, job) => {
    const record: CapturedPrintJob = {
      at: new Date().toISOString(),
      paper: job.paper,
      silent: job.options.silent === true,
      deviceName: job.options.deviceName ?? null,
      pageSize: job.options.pageSize ?? null,
      page: pagePath(contents.getURL()),
    };
    try {
      await mkdir(path.dirname(target), { recursive: true });
      await appendFile(target, `${JSON.stringify(record)}\n`, 'utf8');
      return { success: true, reason: '' };
    } catch (error) {
      return { success: false, reason: `print capture failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  };
}
