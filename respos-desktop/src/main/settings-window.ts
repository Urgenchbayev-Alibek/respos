import { BrowserWindow, screen } from 'electron';
import { BRIDGE_ORIGIN_ARG, SETTINGS_ORIGIN } from '../shared/ipc';
import { iconFile, preloadFile } from './paths';

const PREFERRED_HEIGHT = 800;
const MIN_HEIGHT = 560;

export interface SettingsWindowOptions {
  /** The main window, when it exists: the connection window then opens as its modal child. */
  parent: BrowserWindow | null;
  title: string;
}

/**
 * The connection window: a bundled local page (`respos-shell://settings/`), sandboxed, with its own preload
 * (`window.resposSettings`). It has no menu, cannot navigate anywhere and loads nothing from the network.
 * The caller loads SETTINGS_PAGE_URL into it.
 */
export function createSettingsWindow(options: SettingsWindowOptions): BrowserWindow {
  // Tall enough to show the whole form without scrolling, but never taller than a 1366×768 POS screen.
  const available = screen.getPrimaryDisplay().workAreaSize.height;
  const window = new BrowserWindow({
    width: 560,
    height: Math.max(MIN_HEIGHT, Math.min(PREFERRED_HEIGHT, available - 24)),
    minWidth: 480,
    minHeight: MIN_HEIGHT,
    show: false,
    title: options.title,
    icon: iconFile(),
    backgroundColor: '#f8fafc',
    parent: options.parent ?? undefined,
    modal: options.parent !== null,
    minimizable: options.parent === null,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: preloadFile('settings-preload'),
      additionalArguments: [`${BRIDGE_ORIGIN_ARG}${SETTINGS_ORIGIN}`],
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      spellcheck: false,
      devTools: false,
    },
  });
  window.removeMenu();
  window.once('ready-to-show', () => window.show());
  return window;
}
