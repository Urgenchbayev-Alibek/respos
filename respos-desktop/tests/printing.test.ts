import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { WebContents } from 'electron';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrintCapture } from '../src/main/print-capture';
import { type PrintJob, type PrintJobOutcome, printPage, type PrintSink } from '../src/main/printing';

const RECEIPT_PRINTER = 'POS-80';

interface FakePage {
  contents: WebContents;
  commands: string[];
}

/** The slice of WebContents that printing.ts touches: the printer list and the DevTools protocol session. */
function fakePage(options: { printers?: string[]; printHeightPx?: number; devToolsOpen?: boolean } = {}): FakePage {
  const commands: string[] = [];
  let attached = options.devToolsOpen ?? false;
  const contents = {
    getURL: () => 'http://127.0.0.1:47615/cashier?order=1',
    getPrintersAsync: () => Promise.resolve((options.printers ?? [RECEIPT_PRINTER]).map((name) => ({ name, displayName: name }))),
    debugger: {
      isAttached: () => attached,
      attach: () => {
        attached = true;
      },
      detach: () => {
        attached = false;
      },
      sendCommand: (method: string) => {
        commands.push(method);
        return Promise.resolve(method === 'Runtime.evaluate' ? { result: { value: options.printHeightPx ?? 400 } } : {});
      },
    },
  };
  return { contents: contents as unknown as WebContents, commands };
}

function recordingSink(outcome: PrintJobOutcome = { success: true, reason: '' }): { sink: PrintSink; jobs: PrintJob[] } {
  const jobs: PrintJob[] = [];
  return {
    jobs,
    sink: (_contents, job) => {
      jobs.push(job);
      return Promise.resolve(outcome);
    },
  };
}

const quiet = (): void => undefined;
const silentSettings = { printer: RECEIPT_PRINTER, silentPrint: true };

describe('printPage', () => {
  it('sends a receipt straight to the configured printer on an 80 mm page as tall as the layout', async () => {
    const page = fakePage({ printHeightPx: 400 });
    const { sink, jobs } = recordingSink();

    expect(await printPage(page.contents, { paper: 'receipt-80mm' }, silentSettings, quiet, sink)).toEqual({ ok: true });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.paper).toBe('receipt-80mm');
    expect(jobs[0]?.options).toMatchObject({ silent: true, deviceName: RECEIPT_PRINTER, margins: { marginType: 'none' } });
    // 400 CSS px = 105.83 mm, plus the 3 mm tail.
    expect(jobs[0]?.options.pageSize).toEqual({ width: 80_000, height: 108_834 });
    expect(page.commands).toEqual(['Emulation.setEmulatedMedia', 'Runtime.evaluate']);
    expect(page.contents.debugger.isAttached()).toBe(false);
  });

  it('uses a fixed page height when the layout cannot be measured (DevTools are open)', async () => {
    const page = fakePage({ devToolsOpen: true });
    const { sink, jobs } = recordingSink();

    await printPage(page.contents, { paper: 'receipt-80mm' }, silentSettings, quiet, sink);
    expect(jobs[0]?.options.pageSize).toEqual({ width: 80_000, height: 297_000 });
    expect(page.commands).toEqual([]);
  });

  it('keeps a very short receipt at the minimum page height', async () => {
    const { sink, jobs } = recordingSink();
    await printPage(fakePage({ printHeightPx: 20 }).contents, { paper: 'receipt-80mm' }, silentSettings, quiet, sink);
    expect(jobs[0]?.options.pageSize).toEqual({ width: 80_000, height: 40_000 });
  });

  it('reports a missing printer without starting a job, so the web app falls back to the dialog', async () => {
    const { sink, jobs } = recordingSink();
    const result = await printPage(fakePage({ printers: ['Other'] }).contents, { paper: 'receipt-80mm' }, silentSettings, quiet, sink);
    expect(result).toEqual({ ok: false, reason: 'printer_not_found' });
    expect(jobs).toHaveLength(0);
  });

  it('reports a failed silent job with the reason given by the printer driver', async () => {
    const { sink } = recordingSink({ success: false, reason: 'Invalid printer settings' });
    const result = await printPage(fakePage().contents, { paper: 'receipt-80mm' }, silentSettings, quiet, sink);
    expect(result).toEqual({ ok: false, reason: 'Invalid printer settings' });
  });

  it('never prints an A4 sheet on the receipt printer: it goes through the system dialog', async () => {
    const { sink, jobs } = recordingSink();
    expect(await printPage(fakePage().contents, { paper: 'a4' }, silentSettings, quiet, sink)).toEqual({ ok: true });
    expect(jobs).toEqual([{ paper: 'a4', options: { silent: false, printBackground: false, pageSize: 'A4' } }]);
  });

  it('treats a job without a paper size as A4', async () => {
    const { sink, jobs } = recordingSink();
    await printPage(fakePage().contents, {}, silentSettings, quiet, sink);
    expect(jobs[0]).toMatchObject({ paper: 'a4', options: { silent: false, pageSize: 'A4' } });
  });

  it('opens the dialog for a receipt when silent printing is off or no printer is chosen', async () => {
    for (const settings of [{ printer: RECEIPT_PRINTER, silentPrint: false }, { printer: null, silentPrint: true }]) {
      const { sink, jobs } = recordingSink();
      expect(await printPage(fakePage().contents, { paper: 'receipt-80mm' }, settings, quiet, sink)).toEqual({ ok: true });
      expect(jobs).toEqual([
        { paper: 'receipt-80mm', options: { silent: false, printBackground: false, margins: { marginType: 'none' } } },
      ]);
    }
  });

  it('does not report a dialog the user closed as a failure (no second dialog from the web app)', async () => {
    const cancelled = recordingSink({ success: false, reason: 'Print job canceled' });
    expect(await printPage(fakePage().contents, { paper: 'a4' }, silentSettings, quiet, cancelled.sink)).toEqual({ ok: true });

    const failed = recordingSink({ success: false, reason: 'Invalid printer settings' });
    expect(await printPage(fakePage().contents, { paper: 'a4' }, silentSettings, quiet, failed.sink)).toEqual({
      ok: false,
      reason: 'Invalid printer settings',
    });
  });
});

describe('print capture (RESPOS_DESKTOP_PRINT_CAPTURE)', () => {
  let workDir: string;

  beforeAll(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'respos-desktop-print-'));
  });

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('writes one JSON line per job and reports the job as printed', async () => {
    const file = path.join(workDir, 'nested', 'jobs.jsonl');
    const warnings: string[] = [];
    const sink = createPrintCapture(file, (level, message) => {
      if (level === 'warn') warnings.push(message);
    });
    expect(warnings).toHaveLength(1);

    expect(await printPage(fakePage().contents, { paper: 'receipt-80mm' }, silentSettings, quiet, sink)).toEqual({ ok: true });
    expect(await printPage(fakePage().contents, { paper: 'a4' }, silentSettings, quiet, sink)).toEqual({ ok: true });

    const lines = (await readFile(file, 'utf8')).trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      paper: 'receipt-80mm',
      silent: true,
      deviceName: RECEIPT_PRINTER,
      pageSize: { width: 80_000, height: 108_834 },
      page: '/cashier',
    });
    expect(lines[1]).toMatchObject({ paper: 'a4', silent: false, deviceName: null, pageSize: 'A4', page: '/cashier' });
    expect(Number.isNaN(Date.parse(String(lines[0]?.at)))).toBe(false);
  });

  it('reports a job as failed when the capture file cannot be written', async () => {
    // The target is a directory: appending to it fails.
    const sink = createPrintCapture(workDir, quiet);
    const result = await printPage(fakePage().contents, { paper: 'a4' }, silentSettings, quiet, sink);
    expect(result.ok).toBe(false);
  });
});
