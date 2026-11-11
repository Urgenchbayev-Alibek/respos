import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ResposDesktopApi } from '@/shared/types/desktop';
import { PrintArea } from './PrintArea';
import { PRINT_BODY_ATTRIBUTE, printArea, printPage } from './print-controller';

type DesktopPrint = ResposDesktopApi['print'];
type DesktopPrintResult = Awaited<ReturnType<DesktopPrint>>;

function installDesktop(print: DesktopPrint): void {
  window.resposDesktop = { isDesktop: true, appVersion: '1.0.0-test', openConnectionSettings: async () => undefined, print };
}

/** A bridge whose print jobs stay pending until the test settles them, in call order. */
function pendingDesktopPrint() {
  const settlers: Array<(result: DesktopPrintResult) => void> = [];
  const print = vi.fn<DesktopPrint>(() => new Promise<DesktopPrintResult>((resolve) => settlers.push(resolve)));
  installDesktop(print);
  const settle = (index: number, result: DesktopPrintResult) => act(async () => settlers[index]?.(result));
  return { print, settle };
}

/** Browser dialog stand-in: `window.print()` fires `beforeprint`; the test closes it with `closeDialog()`. */
function mockBrowserPrint() {
  return vi.spyOn(window, 'print').mockImplementation(() => {
    window.dispatchEvent(new Event('beforeprint'));
  });
}

function closeDialog() {
  act(() => {
    window.dispatchEvent(new Event('afterprint'));
  });
}

/** Lets queued desktop jobs start / finish (they run in promise callbacks). */
function flushJobs() {
  return act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('print controller', () => {
  afterEach(() => {
    delete window.resposDesktop;
    vi.restoreAllMocks();
    closeDialog();
  });

  describe('in a browser (no desktop bridge)', () => {
    it('opens the browser print dialog for the requested area', () => {
      const browserPrint = mockBrowserPrint();
      render(<PrintArea id="slip">Чек 80 мм</PrintArea>);

      act(() => printArea('slip'));

      expect(browserPrint).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Чек 80 мм')).toBeInTheDocument();
      closeDialog();
      expect(screen.queryByText('Чек 80 мм')).not.toBeInTheDocument();
    });

    it('prints the whole page with printPage()', () => {
      const browserPrint = mockBrowserPrint();
      render(<PrintArea id="slip">Чек 80 мм</PrintArea>);

      act(() => printPage());

      expect(browserPrint).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Чек 80 мм')).not.toBeInTheDocument();
      expect(document.body.hasAttribute(PRINT_BODY_ATTRIBUTE)).toBe(false);
    });
  });

  describe('in the desktop shell', () => {
    it('prints through the bridge and keeps the print layout until its promise settles', async () => {
      const browserPrint = mockBrowserPrint();
      const { print, settle } = pendingDesktopPrint();
      render(<PrintArea id="slip">Чек 80 мм</PrintArea>);

      printArea('slip');
      await flushJobs();

      expect(print).toHaveBeenCalledTimes(1);
      expect(print).toHaveBeenCalledWith({ paper: 'receipt-80mm' });
      expect(screen.getByText('Чек 80 мм').closest('[data-print-area]')?.parentElement).toBe(document.body);
      expect(document.body.getAttribute(PRINT_BODY_ATTRIBUTE)).toBe('slip');

      // The shell's own print job fires the native events in the page: the layout must survive `afterprint`.
      act(() => {
        window.dispatchEvent(new Event('beforeprint'));
        window.dispatchEvent(new Event('afterprint'));
      });
      expect(screen.getByText('Чек 80 мм')).toBeInTheDocument();
      expect(document.body.getAttribute(PRINT_BODY_ATTRIBUTE)).toBe('slip');

      await settle(0, { ok: true });

      expect(screen.queryByText('Чек 80 мм')).not.toBeInTheDocument();
      expect(document.body.hasAttribute(PRINT_BODY_ATTRIBUTE)).toBe(false);
      expect(browserPrint).not.toHaveBeenCalled();
    });

    it('sends the A4 paper size for a whole-page print', async () => {
      const browserPrint = mockBrowserPrint();
      const { print, settle } = pendingDesktopPrint();

      printPage('a4');
      await flushJobs();

      expect(print).toHaveBeenCalledWith({ paper: 'a4' });
      await settle(0, { ok: true });
      expect(browserPrint).not.toHaveBeenCalled();
    });

    it('falls back to the browser dialog when the shell reports a failure', async () => {
      const browserPrint = mockBrowserPrint();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { print, settle } = pendingDesktopPrint();
      render(<PrintArea id="slip">Чек 80 мм</PrintArea>);

      printArea('slip');
      await flushJobs();
      expect(browserPrint).not.toHaveBeenCalled();

      await settle(0, { ok: false, reason: 'printer offline' });

      expect(print).toHaveBeenCalledTimes(1);
      expect(browserPrint).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('printer offline'));
      // The dialog prints the same area; it is released when the dialog closes.
      expect(screen.getByText('Чек 80 мм')).toBeInTheDocument();
      expect(document.body.getAttribute(PRINT_BODY_ATTRIBUTE)).toBe('slip');
      closeDialog();
      expect(screen.queryByText('Чек 80 мм')).not.toBeInTheDocument();
      expect(document.body.hasAttribute(PRINT_BODY_ATTRIBUTE)).toBe(false);
    });

    it('falls back to the browser dialog when the bridge call rejects', async () => {
      const browserPrint = mockBrowserPrint();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      installDesktop(vi.fn<DesktopPrint>(() => Promise.reject(new Error('ipc closed'))));
      render(<PrintArea id="slip">Чек 80 мм</PrintArea>);

      printArea('slip');
      await flushJobs();

      expect(browserPrint).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Чек 80 мм')).toBeInTheDocument();
    });

    it('runs desktop jobs one at a time, in the order they were requested', async () => {
      mockBrowserPrint();
      const { print, settle } = pendingDesktopPrint();
      render(
        <>
          <PrintArea id="ticket-1">Тикет 1</PrintArea>
          <PrintArea id="ticket-2">Тикет 2</PrintArea>
        </>,
      );

      printArea('ticket-1');
      printArea('ticket-2');
      await flushJobs();

      expect(print).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Тикет 1')).toBeInTheDocument();
      expect(screen.queryByText('Тикет 2')).not.toBeInTheDocument();

      await settle(0, { ok: true });
      await flushJobs();

      expect(print).toHaveBeenCalledTimes(2);
      expect(screen.queryByText('Тикет 1')).not.toBeInTheDocument();
      expect(screen.getByText('Тикет 2')).toBeInTheDocument();
      expect(document.body.getAttribute(PRINT_BODY_ATTRIBUTE)).toBe('ticket-2');

      await settle(1, { ok: true });
      expect(screen.queryByText('Тикет 2')).not.toBeInTheDocument();
      expect(document.body.hasAttribute(PRINT_BODY_ATTRIBUTE)).toBe(false);
    });
  });
});
