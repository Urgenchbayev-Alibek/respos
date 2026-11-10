import { addDaysToDateString } from '@/shared/lib/zoned-time';

/** Monday (ISO week start) of the week containing `date` (`YYYY-MM-DD`). */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return addDaysToDateString(date, -((weekday + 6) % 7));
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDaysToDateString(start, index));
}
