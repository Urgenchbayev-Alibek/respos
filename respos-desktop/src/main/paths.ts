import path from 'node:path';
import { app } from 'electron';

/** `dist/` — the bundled main script lives in `dist/main/`. */
function distDir(): string {
  return path.resolve(__dirname, '..');
}

export function preloadFile(name: 'app-preload' | 'settings-preload'): string {
  return path.join(distDir(), 'preload', `${name}.js`);
}

/** Bundled connection-window page (html + css + js), served through the `respos-shell:` scheme. */
export function settingsUiDir(): string {
  return path.join(distDir(), 'settings');
}

/** Built web app: `resources/web-dist` in an installed app, `respos-desktop/web-dist` in a checkout. */
export function webDistDir(): string {
  return app.isPackaged ? path.join(process.resourcesPath, 'web-dist') : path.join(app.getAppPath(), 'web-dist');
}

/** Window icon: the multi-size .ico on Windows (crisp at every scaling factor), the PNG elsewhere. */
export function iconFile(): string {
  return path.join(app.getAppPath(), 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
}

export function settingsFile(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function logDir(): string {
  return path.join(app.getPath('userData'), 'logs');
}
