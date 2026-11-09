import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { sessionStore } from '@/shared/api/session-store';
import { DEFAULT_LANGUAGE, LANGUAGES, STORAGE_KEYS, isLanguage, type Language } from '@/shared/constants/locale';
import { safeStorage } from '@/shared/lib/safe-storage';

/**
 * Every `locales/<lang>/<namespace>.json` is picked up automatically.
 * Adding a feature namespace = adding three JSON files (ru/uz/en); no registry edit needed.
 */
const modules = import.meta.glob<{ default: Record<string, unknown> }>('./locales/*/*.json', { eager: true });

function buildResources(): { resources: Resource; namespaces: string[] } {
  const resources: Resource = {};
  const namespaces = new Set<string>();
  Object.entries(modules).forEach(([path, module]) => {
    const match = /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
    if (!match) return;
    const [, lang, ns] = match as unknown as [string, string, string];
    resources[lang] ??= {};
    resources[lang][ns] = module.default;
    namespaces.add(ns);
  });
  return { resources, namespaces: [...namespaces] };
}

function initialLanguage(): Language {
  const stored = safeStorage.get(STORAGE_KEYS.language);
  return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
}

const { resources, namespaces } = buildResources();
const lng = initialLanguage();

void i18n.use(initReactI18next).init({
  resources,
  lng,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...LANGUAGES],
  ns: namespaces,
  defaultNS: 'common',
  fallbackNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
  initImmediate: false,
  react: { useSuspense: false },
});

sessionStore.setLanguage(lng);
document.documentElement.lang = lng;

i18n.on('languageChanged', (next) => {
  if (!isLanguage(next)) return;
  sessionStore.setLanguage(next);
  document.documentElement.lang = next;
});

/** Changes UI language and remembers the explicit user choice. */
export function changeLanguage(next: Language): Promise<unknown> {
  safeStorage.set(STORAGE_KEYS.language, next);
  return i18n.changeLanguage(next);
}

/** True if the user explicitly picked a language on this device (then it wins over profile default). */
export function hasStoredLanguage(): boolean {
  return isLanguage(safeStorage.get(STORAGE_KEYS.language));
}

export function currentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
}

export { i18n };
