import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { ru } from './locales/ru';
import { uz } from './locales/uz';
import { isSupportedLanguage, type SupportedLanguage } from './types';

export const LANGUAGE_STORAGE_KEY = 'respos.landing.lang';
const DEFAULT_LANGUAGE: SupportedLanguage = 'ru';

const readStoredLanguage = (): SupportedLanguage => {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

/** BCP 47 tag for the <html lang> attribute. */
const htmlLang = (lng: string): string => (lng === 'uz' ? 'uz-Latn' : lng);

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = htmlLang(lng);
  try {
    if (isSupportedLanguage(lng)) window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    // Storage may be unavailable (private mode); the choice simply is not remembered.
  }
});

void i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    uz: { translation: uz },
    en: { translation: en },
  },
  lng: readStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  initAsync: false,
});

export default i18n;
export { SUPPORTED_LANGUAGES, isSupportedLanguage } from './types';
export type { SupportedLanguage } from './types';
