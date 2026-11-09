import { DEFAULT_TIMEZONE } from '@/shared/constants/locale';

/**
 * Branch-timezone wall clock <-> UTC instant conversions for date/time inputs
 * (`<input type="date">` + `<input type="time">` are interpreted in the branch timezone).
 */
export interface ZonedParts {
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:mm` */
  time: string;
  /** Minutes since local midnight. */
  minutes: number;
}

const pad = (value: number) => String(value).padStart(2, '0');

function partsOf(utcMs: number, timeZone: string): Record<string, number> {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return formatter.formatToParts(new Date(utcMs)).reduce<Record<string, number>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = Number(part.value);
    return acc;
  }, {});
}

function offsetMs(utcMs: number, timeZone: string): number {
  const p = partsOf(utcMs, timeZone);
  const asUtc = Date.UTC(p.year ?? 1970, (p.month ?? 1) - 1, p.day ?? 1, p.hour ?? 0, p.minute ?? 0, p.second ?? 0);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** `2026-11-10` + `19:30` in `Asia/Tashkent` → `2026-11-10T14:30:00.000Z`. Returns '' for invalid input. */
export function zonedToUtcIso(date: string, time: string, timeZone: string = DEFAULT_TIMEZONE): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if (!y || !m || !d || hh === undefined || mm === undefined || Number.isNaN(hh) || Number.isNaN(mm)) return '';
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const first = offsetMs(naive, timeZone);
  let utc = naive - first;
  const second = offsetMs(utc, timeZone);
  if (second !== first) utc = naive - second;
  return new Date(utc).toISOString();
}

/** UTC instant → wall clock parts in the branch timezone. */
export function utcToZonedParts(value: string | Date, timeZone: string = DEFAULT_TIMEZONE): ZonedParts | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const p = partsOf(date.getTime(), timeZone);
  const hour = p.hour ?? 0;
  const minute = p.minute ?? 0;
  return {
    date: `${p.year}-${pad(p.month ?? 1)}-${pad(p.day ?? 1)}`,
    time: `${pad(hour)}:${pad(minute)}`,
    minutes: hour * 60 + minute,
  };
}

/** `YYYY-MM-DD` ± days (calendar arithmetic, timezone independent). */
export function addDaysToDateString(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const result = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
  return `${result.getUTCFullYear()}-${pad(result.getUTCMonth() + 1)}-${pad(result.getUTCDate())}`;
}

/** Adds minutes to `HH:mm`, clamped to 23:59. */
export function addMinutesToTime(time: string, minutes: number): string {
  const [hh, mm] = time.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, (hh ?? 0) * 60 + (mm ?? 0) + minutes));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
