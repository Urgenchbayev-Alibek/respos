export const LANGUAGES = ['ru', 'uz', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'ru';

/** BCP-47 locale used by Intl formatters for each UI language. */
export const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  ru: 'ru-RU',
  uz: 'uz-Latn-UZ',
  en: 'en-US',
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export const DEFAULT_CURRENCY = 'UZS';
export const DEFAULT_TIMEZONE = 'Asia/Tashkent';

/** localStorage keys. Only non-secret UI preferences — never tokens. */
export const STORAGE_KEYS = {
  branchId: 'respos.branchId',
  language: 'respos.language',
  sidebarCollapsed: 'respos.sidebarCollapsed',
} as const;
