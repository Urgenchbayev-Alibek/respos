import type { Language } from '../shared/settings-schema';

/** Strings of the shell's native UI (application menu, dialogs). The connection window has its own table. */
export interface MainStrings {
  menuFile: string;
  connectionSettings: string;
  reload: string;
  exitKiosk: string;
  quit: string;
  menuView: string;
  fullScreen: string;
  zoom: string;
  zoomIn: string;
  zoomOut: string;
  zoomReset: string;
  devTools: string;
  menuHelp: string;
  about: string;
  aboutVersion: string;
  aboutServer: string;
  aboutServerNotSet: string;
  ok: string;
  settingsWindowTitle: string;
  startupFailed: string;
}

const STRINGS: Readonly<Record<Language, MainStrings>> = Object.freeze({
  ru: {
    menuFile: 'Файл',
    connectionSettings: 'Настройки подключения',
    reload: 'Перезагрузить',
    exitKiosk: 'Выйти из режима киоска',
    quit: 'Выход',
    menuView: 'Вид',
    fullScreen: 'Во весь экран',
    zoom: 'Масштаб',
    zoomIn: 'Увеличить',
    zoomOut: 'Уменьшить',
    zoomReset: 'Исходный размер',
    devTools: 'Инструменты разработчика',
    menuHelp: 'Справка',
    about: 'О программе',
    aboutVersion: 'Версия',
    aboutServer: 'Сервер',
    aboutServerNotSet: 'не задан',
    ok: 'ОК',
    settingsWindowTitle: 'RestaurantOS — настройки подключения',
    startupFailed: 'Не удалось запустить RestaurantOS',
  },
  uz: {
    menuFile: 'Fayl',
    connectionSettings: 'Ulanish sozlamalari',
    reload: 'Qayta yuklash',
    exitKiosk: 'Kiosk rejimidan chiqish',
    quit: 'Chiqish',
    menuView: 'Ko‘rinish',
    fullScreen: 'To‘liq ekran',
    zoom: 'Masshtab',
    zoomIn: 'Kattalashtirish',
    zoomOut: 'Kichiklashtirish',
    zoomReset: 'Asl o‘lcham',
    devTools: 'Dasturchi vositalari',
    menuHelp: 'Yordam',
    about: 'Dastur haqida',
    aboutVersion: 'Versiya',
    aboutServer: 'Server',
    aboutServerNotSet: 'ko‘rsatilmagan',
    ok: 'OK',
    settingsWindowTitle: 'RestaurantOS — ulanish sozlamalari',
    startupFailed: 'RestaurantOS dasturini ishga tushirib bo‘lmadi',
  },
  en: {
    menuFile: 'File',
    connectionSettings: 'Connection settings',
    reload: 'Reload',
    exitKiosk: 'Exit kiosk mode',
    quit: 'Exit',
    menuView: 'View',
    fullScreen: 'Full screen',
    zoom: 'Zoom',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    zoomReset: 'Actual size',
    devTools: 'Developer tools',
    menuHelp: 'Help',
    about: 'About',
    aboutVersion: 'Version',
    aboutServer: 'Server',
    aboutServerNotSet: 'not set',
    ok: 'OK',
    settingsWindowTitle: 'RestaurantOS — connection settings',
    startupFailed: 'RestaurantOS could not start',
  },
});

export function mainStrings(language: Language): MainStrings {
  return STRINGS[language];
}
