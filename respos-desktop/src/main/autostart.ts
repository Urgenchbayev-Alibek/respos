import { app } from 'electron';
import type { Logger } from './logger';

/**
 * «Запускать при входе в Windows»: a per-user login item (HKCU, no admin rights).
 * Only an installed/portable build registers itself — a developer run would register the bare electron.exe.
 * The portable build runs from a temp folder, so its real exe path comes from PORTABLE_EXECUTABLE_FILE.
 */
export function applyAutoStart(enabled: boolean, log: Logger): void {
  if (!app.isPackaged) {
    log('info', `autostart=${String(enabled)} is stored but not applied in a development run`);
    return;
  }
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.env.PORTABLE_EXECUTABLE_FILE ?? process.execPath,
      args: [],
    });
  } catch (error) {
    log('warn', `cannot update the login item: ${error instanceof Error ? error.message : String(error)}`);
  }
}
