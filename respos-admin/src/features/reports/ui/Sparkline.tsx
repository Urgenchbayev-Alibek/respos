import styles from './analytics.module.css';

const WIDTH = 120;
const HEIGHT = 32;

/** Decorative inline-SVG trend line (the KPI value next to it carries the number). */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = WIDTH / (values.length - 1);
  const points = values.map((value, index) => `${(index * step).toFixed(1)},${(HEIGHT - ((value - min) / range) * HEIGHT).toFixed(1)}`);
  return (
    <svg className={styles.sparkline} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <polyline points={points.join(' ')} fill="none" stroke="var(--color-primary-strong)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
