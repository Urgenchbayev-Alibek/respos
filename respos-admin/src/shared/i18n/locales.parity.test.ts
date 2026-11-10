import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '@/shared/constants/locale';

/**
 * Permanent guard: every namespace exists in ru/uz/en with the same keys (plural suffixes normalised:
 * ru has _few/_many, uz/en only _one/_other). English must really be English (no Cyrillic except language names).
 */
const modules = import.meta.glob<{ default: Record<string, unknown> }>('./locales/*/*.json', { eager: true });
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const CYRILLIC = /[Ѐ-ӿ]/;
const CYRILLIC_ALLOWED = new Set(['common:languages.ru']);

function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (value === null || typeof value !== 'object') return { [prefix]: String(value) };
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, child]) => ({ ...acc, ...flatten(child, prefix ? `${prefix}.${key}` : key) }),
    {},
  );
}

const byLanguage = new Map<string, Map<string, Record<string, string>>>();
Object.entries(modules).forEach(([path, module]) => {
  const match = /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
  if (!match) return;
  const [, lang, ns] = match as unknown as [string, string, string];
  if (!byLanguage.has(lang)) byLanguage.set(lang, new Map());
  byLanguage.get(lang)?.set(ns, flatten(module.default));
});

const namespaces = [...new Set([...byLanguage.values()].flatMap((map) => [...map.keys()]))].sort();

function keySet(entries: Record<string, string> | undefined): string[] {
  return [...new Set(Object.keys(entries ?? {}).map((key) => key.replace(PLURAL_SUFFIX, '')))].sort();
}

describe('i18n locales', () => {
  it('has a folder for every UI language', () => {
    expect([...byLanguage.keys()].sort()).toEqual([...LANGUAGES].sort());
  });

  it.each(namespaces)('namespace "%s" has identical keys in ru, uz and en', (ns) => {
    const reference = keySet(byLanguage.get('ru')?.get(ns));
    LANGUAGES.forEach((lang) => {
      expect(byLanguage.get(lang)?.has(ns), `${lang}/${ns}.json is missing`).toBe(true);
      expect(keySet(byLanguage.get(lang)?.get(ns)), `${lang}/${ns}.json keys differ from ru`).toEqual(reference);
    });
  });

  it('English texts are translated (no Cyrillic)', () => {
    const untranslated = namespaces.flatMap((ns) =>
      Object.entries(byLanguage.get('en')?.get(ns) ?? {})
        .filter(([key, text]) => CYRILLIC.test(text) && !CYRILLIC_ALLOWED.has(`${ns}:${key}`))
        .map(([key]) => `${ns}:${key}`),
    );
    expect(untranslated).toEqual([]);
  });
});
