import type { ServerUrlError } from './server-url';
import type { EditableSettings, EditableSettingsError } from './settings-schema';

/** Channels the web app (gateway origin) may call. This list and SETTINGS_CHANNELS are the whole IPC surface. */
export const DESKTOP_CHANNELS = Object.freeze({
  openConnectionSettings: 'desktop:open-connection-settings',
  print: 'desktop:print',
} as const);

/** Channels only the bundled connection window may call. */
export const SETTINGS_CHANNELS = Object.freeze({
  getState: 'settings:get-state',
  listPrinters: 'settings:list-printers',
  testConnection: 'settings:test-connection',
  save: 'settings:save',
  close: 'settings:close',
} as const);

/** Renderer process arguments (`webPreferences.additionalArguments`) read by the preload scripts. */
export const APP_VERSION_ARG = '--respos-app-version=';
export const BRIDGE_ORIGIN_ARG = '--respos-bridge-origin=';

/** Custom scheme of the bundled shell pages (`respos-shell://settings/index.html`). */
export const SHELL_SCHEME = 'respos-shell';
export const SETTINGS_HOST = 'settings';
export const SETTINGS_ORIGIN = `${SHELL_SCHEME}://${SETTINGS_HOST}`;
export const SETTINGS_PAGE_URL = `${SETTINGS_ORIGIN}/index.html`;

export const PRINT_PAPERS = ['receipt-80mm', 'a4'] as const;
export type PrintPaper = (typeof PRINT_PAPERS)[number];

export interface PrintOptions {
  paper?: PrintPaper;
}

export type PrintResult = { ok: true } | { ok: false; reason: string };

/** `window.resposDesktop` — the contract from DESIGN.md. Must stay identical to respos-admin's desktop.d.ts. */
export interface ResposDesktopApi {
  readonly isDesktop: true;
  readonly appVersion: string;
  /** Opens the native connection-settings window (server address, printer, kiosk, autostart). */
  openConnectionSettings(): Promise<void>;
  /** Prints the current page; the web app has already applied its @media print layout.
   *  Silent to the configured printer when enabled in desktop settings, otherwise the system dialog. */
  print(options?: PrintOptions): Promise<PrintResult>;
}

export interface PrinterInfo {
  /** System name of the printer: this is what gets stored and passed to the print job. */
  name: string;
  /** Name as the user knows it from Windows. */
  displayName: string;
}

/** Why the connection window is on screen. */
export type SettingsWindowReason = 'first-run' | 'unreachable' | 'manual';

export interface SettingsState {
  settings: EditableSettings;
  printers: PrinterInfo[];
  appVersion: string;
  reason: SettingsWindowReason;
  /** The app was started with `--kiosk`: kiosk mode is on regardless of the stored setting. */
  kioskFlag: boolean;
}

export type ConnectionTestError = ServerUrlError | 'timeout' | 'unreachable' | 'certificate' | 'bad_status';

export type ConnectionTestResult =
  | { ok: true; serverUrl: string }
  | { ok: false; error: ConnectionTestError; status?: number };

/** Save also fails when a NEW server address does not answer: a typo must not sign the user out. */
export type SaveSettingsResult = { ok: true } | { ok: false; error: EditableSettingsError | ConnectionTestError };

/** `window.resposSettings` — exposed ONLY to the bundled connection window by its own preload. */
export interface ResposSettingsApi {
  getState(): Promise<SettingsState>;
  listPrinters(): Promise<PrinterInfo[]>;
  testConnection(serverUrl: string): Promise<ConnectionTestResult>;
  save(settings: EditableSettings): Promise<SaveSettingsResult>;
  close(): Promise<void>;
}
