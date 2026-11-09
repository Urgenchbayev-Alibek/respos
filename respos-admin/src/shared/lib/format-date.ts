import { DEFAULT_TIMEZONE, LOCALE_BY_LANGUAGE, isLanguage } from '@/shared/constants/locale';

export interface DateFormatOptions {
  /** IANA timezone of the current branch. Defaults to Asia/Tashkent. */
  timeZone?: string;
  /** UI language (`ru|uz|en`) or BCP-47 locale. */
  locale?: string;
}

type Input = string | number | Date | null | undefined;

function toDate(value: Input): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveLocale(locale: string | undefined): string {
  if (!locale) return LOCALE_BY_LANGUAGE.ru;
  return isLanguage(locale) ? LOCALE_BY_LANGUAGE[locale] : locale;
}

function format(value: Input, options: DateFormatOptions, parts: Intl.DateTimeFormatOptions): string {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(resolveLocale(options.locale), {
    timeZone: options.timeZone || DEFAULT_TIMEZONE,
    ...parts,
  }).format(date);
}

export const formatDate = (value: Input, options: DateFormatOptions = {}) =>
  format(value, options, { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatTime = (value: Input, options: DateFormatOptions = {}) =>
  format(value, options, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export const formatDateTime = (value: Input, options: DateFormatOptions = {}) =>
  format(value, options, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });

/** `YYYY-MM-DD` of the instant in the branch timezone (for date-only API params). */
export function toBranchDateString(value: Input, timeZone: string = DEFAULT_TIMEZONE): string {
  const date = toDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Whole minutes elapsed since `value` (KDS timers, waiting time). */
export function minutesSince(value: Input, now: Date = new Date()): number {
  const date = toDate(value);
  if (!date) return 0;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
}
