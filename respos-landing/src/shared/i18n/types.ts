/**
 * Shape of a translation tree derived from the Russian source:
 * every other language must provide the same keys (strings may differ).
 */
export type Messages<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Messages<U>[]
    : { readonly [K in keyof T]: Messages<T[K]> };

export const SUPPORTED_LANGUAGES = ['ru', 'uz'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const isSupportedLanguage = (value: string | null | undefined): value is SupportedLanguage =>
  SUPPORTED_LANGUAGES.some((lang) => lang === value);
