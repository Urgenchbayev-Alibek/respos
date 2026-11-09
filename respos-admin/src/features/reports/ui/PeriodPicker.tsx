import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { ReportPeriod } from '@/entities/report/report.types';
import { Input } from '@/shared/ui';
import { PERIOD_PRESETS, type PeriodPreset } from '../model/period';
import styles from './reports.module.css';

export interface PeriodPickerProps {
  preset: PeriodPreset;
  period: ReportPeriod;
  onPresetChange: (preset: PeriodPreset) => void;
  onCustomChange: (period: ReportPeriod) => void;
}

/** Today / 7 days / 30 days / custom range (dates in branch timezone). */
export function PeriodPicker({ preset, period, onPresetChange, onCustomChange }: PeriodPickerProps) {
  const { t } = useTranslation('reports');
  return (
    <div className={styles.period}>
      <div role="group" aria-label={t('period.label')} className={styles.segmented}>
        {PERIOD_PRESETS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={preset === value}
            className={clsx(styles.segment, preset === value && styles.segmentActive)}
            onClick={() => onPresetChange(value)}
          >
            {t(`period.${value}`)}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <>
          <Input
            type="date"
            aria-label={t('period.from')}
            value={period.from}
            max={period.to || undefined}
            onChange={(event) => onCustomChange({ ...period, from: event.target.value })}
          />
          <Input
            type="date"
            aria-label={t('period.to')}
            value={period.to}
            min={period.from || undefined}
            onChange={(event) => onCustomChange({ ...period, to: event.target.value })}
          />
        </>
      )}
    </div>
  );
}
