import type { ReportPeriod } from '@/entities/report/report.types';
import { toBranchDateString } from '@/shared/lib/format-date';

export const PERIOD_PRESETS = ['today', '7d', '30d', 'custom'] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

const DAY_MS = 86_400_000;

/** Inclusive `YYYY-MM-DD` range in the branch timezone; the server does all calculations. */
export function presetPeriod(preset: Exclude<PeriodPreset, 'custom'>, timeZone: string, now: Date = new Date()): ReportPeriod {
  const to = toBranchDateString(now, timeZone);
  const days = preset === 'today' ? 0 : preset === '7d' ? 6 : 29;
  return { from: toBranchDateString(new Date(now.getTime() - days * DAY_MS), timeZone), to };
}

export function isValidPeriod(period: ReportPeriod): boolean {
  return Boolean(period.from && period.to && period.from <= period.to);
}
