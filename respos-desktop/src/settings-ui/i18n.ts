import type { ConnectionTestError } from '../shared/ipc';
import type { EditableSettingsError, Language } from '../shared/settings-schema';

/** Strings of the connection window. Keys are referenced from index.html through `data-i18n*` attributes. */
export interface SettingsStrings {
  title: string;
  languageLabel: string;
  reasonFirstRun: string;
  reasonUnreachable: string;
  serverSection: string;
  serverLabel: string;
  serverHint: string;
  testButton: string;
  testing: string;
  testOk: string;
  printSection: string;
  printerLabel: string;
  printerNone: string;
  printerMissingMark: string;
  refreshPrinters: string;
  silentPrintLabel: string;
  silentPrintHint: string;
  modeSection: string;
  kioskLabel: string;
  kioskHint: string;
  kioskFlagNote: string;
  autoStartLabel: string;
  version: string;
  cancel: string;
  save: string;
  saving: string;
  loadFailed: string;
  saveFailed: string;
  errors: Record<ConnectionTestError | EditableSettingsError, string>;
  /** `{status}` is replaced with the HTTP status code. */
  badStatusWithCode: string;
}

const ru: SettingsStrings = {
  title: 'Настройки подключения',
  languageLabel: 'Язык',
  reasonFirstRun: 'Укажите адрес сервера RestaurantOS, чтобы начать работу.',
  reasonUnreachable:
    'Сервер недоступен. Проверьте адрес и сеть — программа подключится сама, как только сервер ответит.',
  serverSection: 'Сервер',
  serverLabel: 'Адрес сервера',
  serverHint: 'Например: http://192.168.1.10:5080 или https://api.example.uz',
  testButton: 'Проверить соединение',
  testing: 'Проверка…',
  testOk: 'Соединение установлено',
  printSection: 'Печать чеков',
  printerLabel: 'Термопринтер',
  printerNone: 'Не выбран — системный диалог печати',
  printerMissingMark: 'не найден',
  refreshPrinters: 'Обновить список',
  silentPrintLabel: 'Печатать чеки без диалога',
  silentPrintHint: 'Чеки 80 мм сразу уходят на выбранный принтер. Листы A4 печатаются через диалог.',
  modeSection: 'Режим работы',
  kioskLabel: 'Режим киоска',
  kioskHint: 'Во весь экран, без меню — для экрана кухни. Выход: Ctrl+Shift+Q.',
  kioskFlagNote: 'Программа запущена с ключом --kiosk: режим киоска включён независимо от настройки.',
  autoStartLabel: 'Запускать при входе в Windows',
  version: 'Версия',
  cancel: 'Отмена',
  save: 'Сохранить',
  saving: 'Сохранение…',
  loadFailed: 'Не удалось загрузить настройки. Закройте окно и откройте его снова.',
  saveFailed: 'Не удалось сохранить настройки. Попробуйте ещё раз.',
  errors: {
    empty: 'Введите адрес сервера.',
    invalid: 'Адрес сервера указан неверно.',
    unsupported_protocol: 'Адрес должен начинаться с http:// или https://.',
    credentials_not_allowed: 'Не указывайте логин и пароль в адресе сервера.',
    invalid_settings: 'Настройки заполнены неверно.',
    timeout: 'Сервер не ответил за 5 секунд.',
    unreachable: 'Сервер недоступен. Проверьте адрес и подключение к сети.',
    certificate: 'Сертификат сервера не прошёл проверку.',
    bad_status: 'Сервер ответил, но не готов к работе.',
  },
  badStatusWithCode: 'Сервер ответил, но не готов к работе (код {status}).',
};

const uz: SettingsStrings = {
  title: 'Ulanish sozlamalari',
  languageLabel: 'Til',
  reasonFirstRun: 'Ishni boshlash uchun RestaurantOS server manzilini kiriting.',
  reasonUnreachable:
    'Server javob bermayapti. Manzil va tarmoqni tekshiring — server javob berishi bilan dastur o‘zi ulanadi.',
  serverSection: 'Server',
  serverLabel: 'Server manzili',
  serverHint: 'Masalan: http://192.168.1.10:5080 yoki https://api.example.uz',
  testButton: 'Ulanishni tekshirish',
  testing: 'Tekshirilmoqda…',
  testOk: 'Ulanish o‘rnatildi',
  printSection: 'Chek chop etish',
  printerLabel: 'Termoprinter',
  printerNone: 'Tanlanmagan — tizimning chop etish oynasi',
  printerMissingMark: 'topilmadi',
  refreshPrinters: 'Ro‘yxatni yangilash',
  silentPrintLabel: 'Cheklarni oynasiz chop etish',
  silentPrintHint: '80 mm cheklar darhol tanlangan printerga yuboriladi. A4 varaqlar oyna orqali chop etiladi.',
  modeSection: 'Ish rejimi',
  kioskLabel: 'Kiosk rejimi',
  kioskHint: 'To‘liq ekran, menyusiz — oshxona ekrani uchun. Chiqish: Ctrl+Shift+Q.',
  kioskFlagNote: 'Dastur --kiosk kaliti bilan ishga tushirilgan: kiosk rejimi sozlamadan qat’i nazar yoqilgan.',
  autoStartLabel: 'Windows tizimiga kirganda ishga tushirish',
  version: 'Versiya',
  cancel: 'Bekor qilish',
  save: 'Saqlash',
  saving: 'Saqlanmoqda…',
  loadFailed: 'Sozlamalarni yuklab bo‘lmadi. Oynani yopib, qayta oching.',
  saveFailed: 'Sozlamalarni saqlab bo‘lmadi. Qayta urinib ko‘ring.',
  errors: {
    empty: 'Server manzilini kiriting.',
    invalid: 'Server manzili noto‘g‘ri kiritilgan.',
    unsupported_protocol: 'Manzil http:// yoki https:// bilan boshlanishi kerak.',
    credentials_not_allowed: 'Server manzilida login va parol ko‘rsatmang.',
    invalid_settings: 'Sozlamalar noto‘g‘ri to‘ldirilgan.',
    timeout: 'Server 5 soniya ichida javob bermadi.',
    unreachable: 'Server javob bermayapti. Manzil va tarmoq ulanishini tekshiring.',
    certificate: 'Server sertifikati tekshiruvdan o‘tmadi.',
    bad_status: 'Server javob berdi, lekin ishga tayyor emas.',
  },
  badStatusWithCode: 'Server javob berdi, lekin ishga tayyor emas (kod {status}).',
};

const en: SettingsStrings = {
  title: 'Connection settings',
  languageLabel: 'Language',
  reasonFirstRun: 'Enter the address of your RestaurantOS server to get started.',
  reasonUnreachable:
    'The server is not reachable. Check the address and the network — the app connects by itself as soon as the server answers.',
  serverSection: 'Server',
  serverLabel: 'Server address',
  serverHint: 'For example: http://192.168.1.10:5080 or https://api.example.uz',
  testButton: 'Test connection',
  testing: 'Testing…',
  testOk: 'Connection established',
  printSection: 'Receipt printing',
  printerLabel: 'Thermal printer',
  printerNone: 'Not selected — system print dialog',
  printerMissingMark: 'not found',
  refreshPrinters: 'Refresh list',
  silentPrintLabel: 'Print receipts without a dialog',
  silentPrintHint: '80 mm receipts go straight to the selected printer. A4 sheets are printed through the dialog.',
  modeSection: 'Mode',
  kioskLabel: 'Kiosk mode',
  kioskHint: 'Full screen, no menu — for a kitchen display. Exit: Ctrl+Shift+Q.',
  kioskFlagNote: 'The app was started with --kiosk: kiosk mode is on regardless of this setting.',
  autoStartLabel: 'Start when signing in to Windows',
  version: 'Version',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving…',
  loadFailed: 'Settings could not be loaded. Close this window and open it again.',
  saveFailed: 'Settings could not be saved. Please try again.',
  errors: {
    empty: 'Enter the server address.',
    invalid: 'The server address is not valid.',
    unsupported_protocol: 'The address must start with http:// or https://.',
    credentials_not_allowed: 'Do not put a login and password into the server address.',
    invalid_settings: 'The settings are not valid.',
    timeout: 'The server did not answer within 5 seconds.',
    unreachable: 'The server is not reachable. Check the address and the network connection.',
    certificate: 'The server certificate did not pass validation.',
    bad_status: 'The server answered but is not ready.',
  },
  badStatusWithCode: 'The server answered but is not ready (status {status}).',
};

const STRINGS: Readonly<Record<Language, SettingsStrings>> = Object.freeze({ ru, uz, en });

export function settingsStrings(language: Language): SettingsStrings {
  return STRINGS[language];
}

/** Keys that hold a plain string (everything except the nested `errors` table). */
export type PlainStringKey = Exclude<keyof SettingsStrings, 'errors'>;

export function isPlainStringKey(key: string): key is PlainStringKey {
  return key !== 'errors' && key in ru;
}
