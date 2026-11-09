import { useTranslation } from 'react-i18next';
import { ScreenFrame } from './ScreenFrame';
import styles from './Mockups.module.css';

/** Illustrative demo values only. */
const KPIS = [
  { key: 'mock.revenue', value: '8 450 000', unit: 'UZS', delta: '+12%' },
  { key: 'mock.orders', value: '126', unit: '', delta: '+8%' },
  { key: 'mock.avgCheck', value: '67 000', unit: 'UZS', delta: '+3%' },
];

const HOURS = [
  { h: '10', v: 18 },
  { h: '12', v: 62 },
  { h: '13', v: 88 },
  { h: '14', v: 54 },
  { h: '16', v: 30 },
  { h: '18', v: 70 },
  { h: '19', v: 96 },
  { h: '20', v: 82 },
  { h: '22', v: 40 },
];

export function DashboardMock({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <ScreenFrame title={t('mock.dashboard')} className={className}>
      <div className={styles.kpis}>
        {KPIS.map((kpi) => (
          <div key={kpi.key} className={styles.kpi}>
            <span className={styles.kpiLabel}>{t(kpi.key)}</span>
            <span className={styles.kpiValue}>
              {kpi.value}
              {kpi.unit && <small> {kpi.unit}</small>}
            </span>
            <span className={styles.kpiDelta}>{kpi.delta}</span>
          </div>
        ))}
      </div>
      <div className={styles.chart}>
        <span className={styles.chartTitle}>{t('mock.byHour')}</span>
        <div className={styles.bars}>
          {HOURS.map((bar) => (
            <div key={bar.h} className={styles.barCol}>
              <span className={styles.bar} style={{ height: `${Math.round(bar.v * 0.82)}%` }} />
              <span className={styles.barLabel}>{bar.h}</span>
            </div>
          ))}
        </div>
      </div>
    </ScreenFrame>
  );
}
