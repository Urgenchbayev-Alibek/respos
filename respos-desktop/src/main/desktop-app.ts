import { app, type BrowserWindow, dialog, Menu, session, type WebContents } from 'electron';
import { checkServerHealth } from '../gateway/health-check';
import type { LocalGateway } from '../gateway/local-gateway';
import {
  type ConnectionTestResult,
  type PrinterInfo,
  type PrintOptions,
  type PrintResult,
  type SaveSettingsResult,
  SETTINGS_PAGE_URL,
  type SettingsState,
  type SettingsWindowReason,
} from '../shared/ipc';
import { normalizeServerUrl } from '../shared/server-url';
import { type EditableSettings, validateEditableSettings } from '../shared/settings-schema';
import { applyAutoStart } from './autostart';
import { mainStrings } from './i18n';
import type { Logger } from './logger';
import { applyKiosk, createMainWindow } from './main-window';
import { buildApplicationMenu } from './menu';
import { listPrinters, printPage, type PrintSink } from './printing';
import type { SecurityPolicy } from './security';
import { createSettingsWindow } from './settings-window';
import type { SettingsStore } from './settings-store';

/** At startup the user is waiting for a window: a dead server must not hold it back for long. */
const STARTUP_HEALTH_TIMEOUT_MS = 3_000;
const MAX_RENDERER_RELOADS = 3;

export interface DesktopAppDeps {
  store: SettingsStore;
  gateway: LocalGateway;
  log: Logger;
  /** `--kiosk` on the command line. */
  kioskFlag: boolean;
  /** End-to-end runs only: receives the print jobs instead of the printer (see print-capture.ts). */
  printSink?: PrintSink;
}

/** Owns the two windows and every action the menu, the IPC handlers and the app lifecycle can trigger. */
export class DesktopApp implements SecurityPolicy {
  private mainWindow: BrowserWindow | null = null;
  private settingsWindow: BrowserWindow | null = null;
  private settingsReason: SettingsWindowReason = 'manual';
  /** Ctrl+Shift+Q left kiosk mode for this session; the stored setting is not touched. */
  private kioskSuspended = false;
  private rendererReloads = 0;

  constructor(private readonly deps: DesktopAppDeps) {}

  gatewayOrigin(): string {
    return this.deps.gateway.origin;
  }

  roleOf(contents: WebContents): 'web-app' | 'settings' | 'unknown' {
    if (this.isWebAppContents(contents)) return 'web-app';
    if (this.isSettingsContents(contents)) return 'settings';
    return 'unknown';
  }

  isWebAppContents(contents: WebContents): boolean {
    return this.mainWindow !== null && !this.mainWindow.isDestroyed() && this.mainWindow.webContents === contents;
  }

  isSettingsContents(contents: WebContents): boolean {
    return (
      this.settingsWindow !== null && !this.settingsWindow.isDestroyed() && this.settingsWindow.webContents === contents
    );
  }

  /** First run or a dead server → connection window; otherwise straight to the web app. */
  async start(): Promise<void> {
    const settings = this.deps.store.get();
    this.refreshMenu();
    applyAutoStart(settings.autoStart, this.deps.log);
    if (settings.serverUrl === null) {
      this.openConnectionSettings('first-run');
      return;
    }
    const health = await checkServerHealth(settings.serverUrl, STARTUP_HEALTH_TIMEOUT_MS);
    if (health.ok) {
      this.showMainWindow();
    } else {
      this.deps.log('warn', `server is not reachable at startup (${health.error})`);
      this.openConnectionSettings('unreachable');
    }
  }

  /** A second copy of the app was started: bring the running one to the front instead. */
  focus(): void {
    const window = this.settingsWindow ?? this.mainWindow;
    if (!window || window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }

  openConnectionSettings(reason: SettingsWindowReason): void {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.focus();
      return;
    }
    this.settingsReason = reason;
    const title = mainStrings(this.deps.store.get().language).settingsWindowTitle;
    const window = createSettingsWindow({ parent: this.mainWindow, title });
    this.settingsWindow = window;
    window.on('closed', () => {
      if (this.settingsWindow === window) this.settingsWindow = null;
    });
    this.logPreloadErrors(window);
    window.loadURL(SETTINGS_PAGE_URL).catch((error: unknown) => {
      this.deps.log('error', `connection window failed to load: ${String(error)}`);
    });
  }

  closeConnectionSettings(): void {
    // Deferred so the IPC reply reaches the page before its window goes away.
    setImmediate(() => {
      if (this.settingsWindow && !this.settingsWindow.isDestroyed()) this.settingsWindow.close();
    });
  }

  async settingsState(contents: WebContents): Promise<SettingsState> {
    return {
      settings: this.editableSettings(),
      printers: await listPrinters(contents),
      appVersion: app.getVersion(),
      reason: this.settingsReason,
      kioskFlag: this.deps.kioskFlag,
    };
  }

  printers(contents: WebContents): Promise<PrinterInfo[]> {
    return listPrinters(contents);
  }

  /** «Проверить соединение»: main asks `<serverUrl>/health/ready` (5 s deadline); the page has no network. */
  async testConnection(input: string): Promise<ConnectionTestResult> {
    const normalized = normalizeServerUrl(input);
    if (!normalized.ok) return { ok: false, error: normalized.error };
    const health = await checkServerHealth(normalized.url);
    if (health.ok) return { ok: true, serverUrl: normalized.url };
    return health.status === undefined
      ? { ok: false, error: health.error }
      : { ok: false, error: health.error, status: health.status };
  }

  /** Save: persist, retarget the gateway, apply kiosk / autostart / language, open (or reload) the web app. */
  async saveSettings(raw: unknown): Promise<SaveSettingsResult> {
    const validated = validateEditableSettings(raw);
    if (!validated.ok) return { ok: false, error: validated.error };

    const previous = this.deps.store.get();
    const next = await this.deps.store.update(validated.value);
    const serverChanged = previous.serverUrl !== next.serverUrl;
    if (serverChanged) {
      this.deps.gateway.setTarget(next.serverUrl);
      this.deps.log('info', `server address set to ${next.serverUrl ?? '<none>'}`);
      // Session cookie, device token and cached ids belong to the previous server.
      if (previous.serverUrl !== null) await session.defaultSession.clearStorageData();
    }
    if (previous.autoStart !== next.autoStart) applyAutoStart(next.autoStart, this.deps.log);
    if (previous.kiosk !== next.kiosk) this.kioskSuspended = false;
    this.refreshMenu();

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      applyKiosk(this.mainWindow, this.kioskWanted);
      if (serverChanged) this.loadWebApp(this.mainWindow);
    } else {
      this.showMainWindow();
    }
    this.closeConnectionSettings();
    return { ok: true };
  }

  print(contents: WebContents, options: PrintOptions): Promise<PrintResult> {
    return printPage(contents, options, this.deps.store.get(), this.deps.log, this.deps.printSink);
  }

  private get kioskWanted(): boolean {
    return (this.deps.kioskFlag || this.deps.store.get().kiosk) && !this.kioskSuspended;
  }

  private get devTools(): boolean {
    return !app.isPackaged;
  }

  private editableSettings(): EditableSettings {
    const { serverUrl, printer, silentPrint, kiosk, autoStart, language } = this.deps.store.get();
    return { serverUrl, printer, silentPrint, kiosk, autoStart, language };
  }

  private showMainWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.show();
      return;
    }
    const window = createMainWindow({
      gatewayOrigin: this.deps.gateway.origin,
      savedBounds: this.deps.store.get().windowBounds,
      kiosk: this.kioskWanted,
      devTools: this.devTools,
      onBoundsChanged: (windowBounds) => {
        this.deps.store.update({ windowBounds }).catch((error: unknown) => {
          this.deps.log('warn', `window bounds were not saved: ${String(error)}`);
        });
      },
      onExitKioskRequested: () => this.exitKiosk(),
    });
    this.mainWindow = window;
    window.on('closed', () => {
      if (this.mainWindow === window) this.mainWindow = null;
    });
    window.webContents.on('render-process-gone', (_event, details) => {
      this.deps.log('error', `renderer process is gone (${details.reason})`);
      if (details.reason === 'clean-exit' || window.isDestroyed()) return;
      this.rendererReloads += 1;
      if (this.rendererReloads <= MAX_RENDERER_RELOADS) this.loadWebApp(window);
    });
    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, _url, isMainFrame) => {
      if (isMainFrame) this.deps.log('error', `web app failed to load: ${errorDescription} (${errorCode})`);
    });
    this.logPreloadErrors(window);
    this.loadWebApp(window);
    this.refreshMenu();
  }

  /** A preload that fails leaves the page without its bridge and says nothing: the log is the only trace. */
  private logPreloadErrors(window: BrowserWindow): void {
    window.webContents.on('preload-error', (_event, preloadPath, error) => {
      this.deps.log('error', `preload ${preloadPath} failed: ${error.message}`);
    });
  }

  private loadWebApp(window: BrowserWindow): void {
    window.loadURL(`${this.deps.gateway.origin}/`).catch((error: unknown) => {
      this.deps.log('error', `web app failed to load: ${String(error)}`);
    });
  }

  private exitKiosk(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed() || !this.mainWindow.isKiosk()) return;
    this.kioskSuspended = true;
    applyKiosk(this.mainWindow, false);
    this.refreshMenu();
  }

  private showAbout(): void {
    const settings = this.deps.store.get();
    const t = mainStrings(settings.language);
    const options = {
      type: 'info' as const,
      title: t.about,
      message: 'RestaurantOS',
      detail: `${t.aboutVersion}: ${app.getVersion()}\n${t.aboutServer}: ${settings.serverUrl ?? t.aboutServerNotSet}`,
      buttons: [t.ok],
      noLink: true,
    };
    const parent = this.mainWindow && !this.mainWindow.isDestroyed() ? this.mainWindow : null;
    const shown = parent ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options);
    shown.catch((error: unknown) => this.deps.log('warn', `about dialog failed: ${String(error)}`));
  }

  private refreshMenu(): void {
    const state = {
      language: this.deps.store.get().language,
      kiosk: this.mainWindow !== null && !this.mainWindow.isDestroyed() && this.kioskWanted,
      devTools: this.devTools,
    };
    Menu.setApplicationMenu(
      buildApplicationMenu(state, {
        openConnectionSettings: () => this.openConnectionSettings('manual'),
        reload: () => this.mainWindow?.webContents.reload(),
        exitKiosk: () => this.exitKiosk(),
        showAbout: () => this.showAbout(),
        quit: () => app.quit(),
      }),
    );
    // On Windows the application menu is attached to every open window; the connection window has none.
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) this.settingsWindow.removeMenu();
  }
}
