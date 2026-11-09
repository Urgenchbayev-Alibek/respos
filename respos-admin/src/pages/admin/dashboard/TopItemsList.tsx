import { useTranslation } from 'react-i18next';
import type { DashboardDto } from '@/entities/dashboard/dashboard.queries';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { EmptyState, Skeleton } from '@/shared/ui';
import styles from './DashboardPage.module.css';

export function TopItemsList({ items, loading }: { items: DashboardDto['topItems'] | undefined; loading: boolean }) {
  const { t } = useTranslation('dashboard');
  const format = useFormatters();

  if (loading) {
    return (
      <div className={styles.skeletonList}>
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} height={18} />
        ))}
      </div>
    );
  }
  if (!items || items.length === 0) return <EmptyState compact title={t('noTopItems')} />;

  const max = Math.max(...items.map((item) => item.revenue), 1);
  return (
    <ol className={styles.topList}>
      {items.map((item) => (
        <li key={item.name} className={styles.topItem}>
          <div className={styles.topRow}>
            <span className={styles.topName}>{item.name}</span>
            <span className={styles.topValue}>
              {t('topItemQuantity', { count: item.quantity })} · {format.money(item.revenue)}
            </span>
          </div>
          <span className={styles.bar} aria-hidden="true">
            <span style={{ width: `${(item.revenue / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ol>
  );
}
