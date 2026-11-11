import { Menu, type MenuItemConstructorOptions } from 'electron';
import type { Language } from '../shared/settings-schema';
import { mainStrings } from './i18n';

export interface MenuActions {
  openConnectionSettings(): void;
  reload(): void;
  exitKiosk(): void;
  showAbout(): void;
  quit(): void;
}

export interface MenuState {
  language: Language;
  kiosk: boolean;
  devTools: boolean;
}

/**
 * Application menu (Russian by default, follows the shell language):
 * Файл — Настройки подключения, Перезагрузить, Выход · Вид — Во весь экран (F11), Масштаб · Справка — О программе.
 */
export function buildApplicationMenu(state: MenuState, actions: MenuActions): Menu {
  const t = mainStrings(state.language);

  const fileMenu: MenuItemConstructorOptions[] = [
    { label: t.connectionSettings, accelerator: 'CmdOrCtrl+,', click: () => actions.openConnectionSettings() },
    { label: t.reload, accelerator: 'CmdOrCtrl+R', click: () => actions.reload() },
    { type: 'separator' },
  ];
  if (state.kiosk) {
    fileMenu.push({ label: t.exitKiosk, accelerator: 'CmdOrCtrl+Shift+Q', click: () => actions.exitKiosk() });
  }
  fileMenu.push({ label: t.quit, accelerator: 'Alt+F4', click: () => actions.quit() });

  const viewMenu: MenuItemConstructorOptions[] = [
    // Kiosk mode owns the full-screen state; F11 must not drop a kitchen screen out of it.
    { label: t.fullScreen, role: 'togglefullscreen', accelerator: 'F11', enabled: !state.kiosk },
    {
      label: t.zoom,
      submenu: [
        { label: t.zoomIn, role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { label: t.zoomOut, role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { label: t.zoomReset, role: 'resetZoom', accelerator: 'CmdOrCtrl+0' },
      ],
    },
  ];
  if (state.devTools) {
    viewMenu.push({ type: 'separator' }, { label: t.devTools, role: 'toggleDevTools', accelerator: 'F12' });
  }

  return Menu.buildFromTemplate([
    { label: t.menuFile, submenu: fileMenu },
    { label: t.menuView, submenu: viewMenu },
    { label: t.menuHelp, submenu: [{ label: t.about, click: () => actions.showAbout() }] },
  ]);
}
