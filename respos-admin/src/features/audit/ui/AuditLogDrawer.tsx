import { useTranslation } from 'react-i18next';
import { formatAuditChanges } from '@/entities/audit-log/audit-log.queries';
import type { AuditLogDto } from '@/entities/audit-log/audit-log.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Drawer } from '@/shared/ui';
import styles from './audit.module.css';

/** Read-only details; long JSON is collapsible. Values are already sanitized by the server. */
export function AuditLogDrawer({ entry, onClose }: { entry: AuditLogDto | null; onClose: () => void }) {
  const { t } = useTranslation('audit');
  const format = useFormatters();
  const changes = entry ? formatAuditChanges(entry) : null;
  const rows: [string, string | null | undefined][] = entry
    ? [
        [t('columns.time'), format.dateTime(entry.createdAt)],
        [t('columns.user'), entry.userName ?? entry.userId],
        [t('columns.branch'), entry.branchName ?? entry.branchId],
        [t('columns.action'), entry.action],
        [t('columns.entityType'), entry.entityType],
        [t('columns.entityId'), entry.entityId],
        [t('columns.correlationId'), entry.correlationId],
        [t('columns.ip'), entry.ipAddress],
      ]
    : [];

  return (
    <Drawer open={entry !== null} onClose={onClose} title={t('details')} width={560}>
      <dl className={styles.details}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.detailRow}>
            <dt>{label}</dt>
            <dd className={styles.mono}>{value || '—'}</dd>
          </div>
        ))}
      </dl>
      <details className={styles.changes} open={(changes?.length ?? 0) < 2000}>
        <summary>{t('changes')}</summary>
        {changes ? <pre className={styles.json}>{changes}</pre> : <p>{t('noChanges')}</p>}
      </details>
    </Drawer>
  );
}
