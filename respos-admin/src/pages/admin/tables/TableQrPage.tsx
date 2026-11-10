import { ArrowLeft, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useBranches } from '@/entities/branch/branch.queries';
import { useTables } from '@/entities/table/table.queries';
import { compareTableNumbers } from '@/entities/table/table.types';
import { tableMenuUrl } from '@/features/qr-menu/model/qr';
import { TableQrCard } from '@/features/qr-menu/ui/TableQrCard';
import styles from '@/features/qr-menu/ui/QrSheet.module.css';
import { env } from '@/shared/config/env';
import { buildPath, ROUTES } from '@/shared/constants/routes';
import { useAuth } from '@/shared/hooks/use-auth';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { Alert, Button, Card, Checkbox, EmptyState, ErrorState, PageHeader, PageLoader } from '@/shared/ui';

/** Admin: pick tables → printable A4 sheet of QR cards linking to the public menu of the current branch. */
export function TableQrPage() {
  const { t } = useTranslation('qrMenu');
  const { user } = useAuth();
  const { branch } = useCurrentBranch();
  const tables = useTables();
  const branches = useBranches();
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const slug = branches.data?.find((b) => b.id === branch?.id)?.slug ?? null;
  const restaurantName = user?.currentOrganization?.name ?? '';

  const sorted = useMemo(
    () => (tables.data ?? []).filter((table) => table.isActive).sort(compareTableNumbers),
    [tables.data],
  );
  const chosen = selected ?? new Set(sorted.map((table) => table.id));
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const printable = sorted.filter((table) => chosen.has(table.id));

  const loading = tables.isLoading || branches.isLoading;
  const error = tables.error ?? branches.error;
  return (
    <>
      <PageHeader
        back={
          <Link to={ROUTES.admin.tables}>
            <ArrowLeft size={14} aria-hidden="true" /> {t('sheet.back')}
          </Link>
        }
        title={t('sheet.title')}
        description={t('sheet.subtitle')}
        actions={
          <Button variant="primary" icon={<Printer />} disabled={!slug || printable.length === 0} onClick={() => window.print()}>
            {t('sheet.print', { count: printable.length })}
          </Button>
        }
      />
      {loading && <PageLoader />}
      {error && <ErrorState error={error} onRetry={() => void Promise.all([tables.refetch(), branches.refetch()])} />}
      {!loading && !error && !slug && (
        <Alert>
          {t('sheet.noSlug')}{' '}
          {branch && <Link to={buildPath(ROUTES.admin.branchSettings, { branchId: branch.id })}>{t('sheet.openSettings')}</Link>}
        </Alert>
      )}
      {!loading && !error && slug && sorted.length === 0 && <EmptyState title={t('sheet.noTables')} />}
      {!loading && !error && slug && sorted.length > 0 && (
        <div className={styles.layout}>
          <Card title={t('sheet.tables')}>
            <div className={styles.picker}>
              <div>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(sorted.map((table) => table.id)))}>
                  {t('sheet.selectAll')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  {t('sheet.selectNone')}
                </Button>
              </div>
              <ul className={styles.pickerList}>
                {sorted.map((table) => (
                  <li key={table.id}>
                    <Checkbox
                      label={t('sheet.tableOption', { number: table.number, area: table.areaName })}
                      checked={chosen.has(table.id)}
                      onChange={() => toggle(table.id)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </Card>
          <div className={styles.sheet} aria-label={t('sheet.preview')}>
            {printable.map((table) => (
              <TableQrCard
                key={table.id}
                url={tableMenuUrl(env.landingUrl, slug, table.number)}
                tableNumber={table.number}
                restaurantName={restaurantName}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
