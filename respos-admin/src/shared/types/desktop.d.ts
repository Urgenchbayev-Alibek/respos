/**
 * Bridge exposed by the RestaurantOS desktop shell (Electron preload, `contextBridge`); absent in a browser.
 * Contract source: `respos-desktop/DESIGN.md` — both sides must stay identical.
 */
export interface ResposDesktopApi {
  readonly isDesktop: true;
  readonly appVersion: string;
  /** Opens the native connection-settings window (server address, printer, kiosk, autostart). */
  openConnectionSettings(): Promise<void>;
  /** Prints the current page; the web app has already applied its @media print layout.
   *  Silent to the configured printer when enabled in desktop settings, otherwise the system dialog. */
  print(options?: { paper?: 'receipt-80mm' | 'a4' }): Promise<{ ok: true } | { ok: false; reason: string }>;
}

declare global {
  interface Window {
    resposDesktop?: ResposDesktopApi;
  }
}
