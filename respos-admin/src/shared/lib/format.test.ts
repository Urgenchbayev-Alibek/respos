import { describe, expect, it } from 'vitest';
import { formatCurrency, parseMoneyInput } from './format-currency';
import { formatDate, formatDateTime, formatTime, minutesSince, toBranchDateString } from './format-date';
import { formatUnit } from './format-unit';
import { i18n } from '@/shared/i18n';

/** Intl uses narrow/no-break spaces as group separators; normalize for assertions. */
const normalize = (value: string) => value.replace(/\s/g, ' ');

describe('formatCurrency', () => {
  it('formats UZS in Russian locale with grouping and no forced decimals', () => {
    const result = normalize(formatCurrency(1250000, { currency: 'UZS', locale: 'ru' }));
    expect(result).toMatch(/^1 250 000/);
    expect(result).not.toMatch(/,00/);
  });

  it('keeps up to 2 decimals', () => {
    expect(normalize(formatCurrency(1234.5, { currency: 'USD', locale: 'en' }))).toBe('$1,234.5');
    expect(normalize(formatCurrency(10.256, { currency: 'USD', locale: 'en' }))).toBe('$10.26');
  });

  it('uses the organization currency', () => {
    expect(formatCurrency(5, { currency: 'EUR', locale: 'en' })).toContain('€');
  });

  it('can omit the currency', () => {
    expect(normalize(formatCurrency(15000, { locale: 'ru', withCurrency: false }))).toBe('15 000');
  });

  it('renders a dash for missing values', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
  });
});

describe('parseMoneyInput', () => {
  it.each([
    ['12 500', 12500],
    ['12 500,50', 12500.5],
    ['12,500.75', 12500.75],
    ['1.234,5', 1234.5],
    ['0,999', 1],
    ['', null],
    ['abc', null],
  ])('parses %s', (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });
});

describe('format-date (branch timezone)', () => {
  const instant = '2026-11-10T20:30:00Z';

  it('formats in Asia/Tashkent (UTC+5) by default', () => {
    expect(formatTime(instant, { locale: 'ru' })).toBe('01:30');
    expect(formatDate(instant, { locale: 'ru' })).toBe('11.11.2026');
    expect(formatDateTime(instant, { locale: 'ru' })).toMatch(/11\.11\.2026.*01:30/);
  });

  it('respects another timezone', () => {
    expect(formatTime(instant, { locale: 'ru', timeZone: 'UTC' })).toBe('20:30');
  });

  it('returns a dash for invalid input', () => {
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatDate(null)).toBe('—');
  });

  it('computes the branch-local calendar date', () => {
    expect(toBranchDateString(instant, 'Asia/Tashkent')).toBe('2026-11-11');
    expect(toBranchDateString(instant, 'UTC')).toBe('2026-11-10');
  });

  it('computes elapsed minutes', () => {
    expect(minutesSince('2026-11-10T10:00:00Z', new Date('2026-11-10T10:12:59Z'))).toBe(12);
  });
});

describe('formatUnit', () => {
  it('localizes known unit codes and keeps custom codes as-is', async () => {
    await i18n.changeLanguage('ru');
    expect(formatUnit('kg')).toBe('кг');
    expect(formatUnit('pcs')).toBe('шт');
    expect(formatUnit('box')).toBe('box');
    expect(formatUnit(undefined)).toBe('');
    await i18n.changeLanguage('uz');
    expect(formatUnit('pcs')).toBe('dona');
    await i18n.changeLanguage('ru');
  });
});
