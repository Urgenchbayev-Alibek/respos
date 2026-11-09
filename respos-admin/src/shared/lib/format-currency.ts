import { DEFAULT_CURRENCY, LOCALE_BY_LANGUAGE, isLanguage } from '@/shared/constants/locale';

export interface MoneyFormatOptions {
  /** ISO 4217 currency of the organization (MeDto.currentOrganization.currency). Defaults to UZS. */
  currency?: string;
  /** UI language (`ru|uz|en`) or a BCP-47 locale. */
  locale?: string;
  /** Show the currency symbol/code. Default true. */
  withCurrency?: boolean;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function resolveLocale(locale: string | undefined): string {
  if (!locale) return LOCALE_BY_LANGUAGE.ru;
  return isLanguage(locale) ? LOCALE_BY_LANGUAGE[locale] : locale;
}

function getFormatter(locale: string, currency: string, withCurrency: boolean): Intl.NumberFormat {
  const cacheKey = `${locale}|${currency}|${withCurrency}`;
  let formatter = formatterCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      ...(withCurrency ? { style: 'currency', currency, currencyDisplay: 'narrowSymbol' } : {}),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    formatterCache.set(cacheKey, formatter);
  }
  return formatter;
}

/**
 * THE money formatter. Money arrives from the API as a JSON number with ≤ 2 decimals;
 * this function only displays it — all calculations happen on the server.
 */
export function formatCurrency(amount: number | null | undefined, options: MoneyFormatOptions = {}): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  const locale = resolveLocale(options.locale);
  const currency = options.currency || DEFAULT_CURRENCY;
  try {
    return getFormatter(locale, currency, options.withCurrency ?? true).format(amount);
  } catch {
    return `${getFormatter(locale, currency, false).format(amount)} ${currency}`;
  }
}

/** Parses user input like "12 500,50" or "12,500.50" into a number (≤ 2 decimals) or null. */
export function parseMoneyInput(input: string): number | null {
  const cleaned = input.replace(/[\s\u00A0\u202F]/g, '').replace(/[^\d.,-]/g, '');
  if (!cleaned) return null;
  const lastSeparator = Math.max(cleaned.lastIndexOf(','), cleaned.lastIndexOf('.'));
  const normalized =
    lastSeparator === -1
      ? cleaned
      : `${cleaned.slice(0, lastSeparator).replace(/[.,]/g, '')}.${cleaned.slice(lastSeparator + 1)}`;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}
