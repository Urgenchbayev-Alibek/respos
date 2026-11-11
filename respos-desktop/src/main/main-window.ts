import { app, BrowserWindow, type Rectangle, screen } from 'electron';
import { APP_VERSION_ARG, BRIDGE_ORIGIN_ARG } from '../shared/ipc';
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, type WindowBounds } from '../shared/settings-schema';
import { iconFile, preloadFile } from './paths';

const DEFAULT_SIZE = { width: 1280, height: 800 } as const;
const BOUNDS_SAVE_DELAY_MS = 500;
/** A restored window must show at least this much of itself on some display. */
const MIN_VISIBLE_PX = 120;

export interface MainWindowOptions {
  gatewayOrigin: string;
  savedBounds: WindowBounds | null;
  kiosk: boolean;
  devTools: boolean;
  onBoundsChanged(bounds: WindowBounds): void;
  /** Ctrl+Shift+Q while the window is in kiosk mode. */
  onExitKioskRequested(): void;
}

function overlap(a: Rectangle, b: Rectangle): { width: number; height: number } {
  return {
    width: Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    height: Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  };
}

/** Saved bounds are reused only while they are still on a connected display (monitors get unplugged). */
function restoreBounds(saved: WindowBounds | null): Partial<Rectangle> & { width: number; height: number } {
  if (!saved) return { ...DEFAULT_SIZE };
  if (saved.x === null || saved.y === null) return { width: saved.width, height: saved.height };
  const wanted: Rectangle = { x: saved.x, y: saved.y, width: saved.width, height: saved.height };
  const workArea = screen.getDisplayMatching(wanted).workArea;
  const visible = overlap(wanted, workArea);
  if (visible.width >= MIN_VISIBLE_PX && visible.height >= MIN_VISIBLE_PX) return wanted;
  return { width: Math.min(saved.width, workArea.width), height: Math.min(saved.height, workArea.height) };
}

function sameBounds(a: WindowBounds, b: WindowBounds): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.maximized === b.maximized;
}

function currentBounds(window: BrowserWindow): WindowBounds {
  const normal = window.getNormalBounds();
  return {
    x: normal.x,
    y: normal.y,
    width: Math.max(MIN_WINDOW_WIDTH, normal.width),
    height: Math.max(MIN_WINDOW_HEIGHT, normal.height),
    maximized: window.isMaximized(),
  };
}

/**
 * The one window that shows the web app. Sandboxed renderer, isolated preload exposing only
 * `window.resposDesktop`, no Node integration. Navigation rules live in `security.ts`.
 */
export function createMainWindow(options: MainWindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    ...restoreBounds(options.savedBounds),
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    title: 'RestaurantOS',
    icon: iconFile(),
    backgroundColor: '#f8fafc',
    kiosk: options.kiosk,
    autoHideMenuBar: false,
    webPreferences: {
      preload: preloadFile('app-preload'),
      additionalArguments: [`${APP_VERSION_ARG}${app.getVersion()}`, `${BRIDGE_ORIGIN_ARG}${options.gatewayOrigin}`],
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
      devTools: options.devTools,
      // A kitchen screen must keep its timers and realtime connection alive while another window is in front.
      backgroundThrottling: false,
    },
  });
  window.setMenuBarVisibility(!options.kiosk);

  // Bounds are written only when they differ from what the window started with (or was last saved with).
  // With fractional display scaling Windows rounds a restored size by a few pixels; saving that back on every
  // close would make the window creep from launch to launch.
  let baseline: WindowBounds | null = null;
  // Until the window is on screen every size change comes from the system (that same rounding), never from
  // the user — and a slow first page load leaves plenty of time for a save timer to fire before the baseline
  // exists. Nothing is saved before then.
  let shown = false;
  const isNormalState = (): boolean => !window.isKiosk() && !window.isFullScreen() && !window.isMinimized();
  const resetBaseline = (): void => {
    baseline = isNormalState() ? currentBounds(window) : null;
  };
  window.once('ready-to-show', () => {
    if (options.savedBounds?.maximized && !options.kiosk) window.maximize();
    window.show();
    resetBaseline();
    shown = true;
  });
  // Leaving kiosk / full screen puts the window back where it was: that is not a change made by the user.
  window.on('leave-full-screen', resetBaseline);

  let saveTimer: NodeJS.Timeout | null = null;
  const saveBounds = (): void => {
    saveTimer = null;
    if (!shown || window.isDestroyed() || !isNormalState()) return;
    const bounds = currentBounds(window);
    if (baseline && sameBounds(bounds, baseline)) return;
    baseline = bounds;
    options.onBoundsChanged(bounds);
  };
  const scheduleSave = (): void => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveBounds, BOUNDS_SAVE_DELAY_MS);
  };
  window.on('resize', scheduleSave);
  window.on('move', scheduleSave);
  window.on('maximize', scheduleSave);
  window.on('unmaximize', scheduleSave);
  window.on('close', () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveBounds();
  });

  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    // `code` is the physical key: the shortcut works on Russian and Uzbek keyboard layouts too.
    if (input.control && input.shift && !input.alt && input.code === 'KeyQ' && window.isKiosk()) {
      event.preventDefault();
      options.onExitKioskRequested();
    } else if (input.code === 'F5' && !input.control && !input.alt && !input.shift) {
      event.preventDefault();
      window.webContents.reload();
    }
  });

  return window;
}

/** Switches kiosk mode on a live window (setting changed, or Ctrl+Shift+Q). */
export function applyKiosk(window: BrowserWindow, kiosk: boolean): void {
  if (window.isKiosk() !== kiosk) window.setKiosk(kiosk);
  window.setMenuBarVisibility(!kiosk);
}
