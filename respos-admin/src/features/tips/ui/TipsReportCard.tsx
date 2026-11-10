import { useTranslation } from 'react-i18next';
import { useTipsReport } from '@/entities/billing/billing.queries';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Card, EmptyState, ErrorState, Skeleton } from '@/shared/ui';
import styles from './TipsReportCard.module.css';

/** `GET /reports/tips` — tips per waiter for local dates (default: today). Tips are not revenue. */
export function TipsReportCard({ from, to }: { from?: string; to?: string }) {
  const { t } = useTranslation('billing');
  const format = useFormatters();
  const report = useTipsReport({ ...(from ? { from } : {}), ...(to ? { to } : {}) });

  return (
    <Card title={t('tipsReport.title')} className={styles.card}>
      {report.isPending && <Skeleton height={64} />}
      {report.isError && <ErrorState compact error={report.error} onRetry={() => void report.refetch()} />}
      {report.data && report.data.rows.length === 0 && <EmptyState compact title={t('tipsReport.empty')} />}
      {report.data && report.data.rows.length > 0 && (
        <>
          <p className={styles.total} data-testid="tips-total">
            {t('tipsReport.total', { amount: format.money(report.data.totalTips) })}
          </p>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('tipsReport.waiter')}</th>
                  <th scope="col" className={styles.num}>{t('tipsReport.count')}</th>
                  <th scope="col" className={styles.num}>{t('tipsReport.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {report.data.rows.map((row) => (
                  <tr key={row.waiterId}>
                    <td>{row.waiterName ?? t('tipsReport.unknownWaiter')}</td>
                    <td className={styles.num}>{format.number(row.paymentsCount)}</td>
                    <td className={styles.num}>{format.money(row.tipsAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
