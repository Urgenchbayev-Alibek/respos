import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useBranches } from '@/entities/branch/branch.queries';
import { useOrganization } from '@/entities/organization/organization.queries';
import { OrganizationForm } from '@/features/organization/ui/OrganizationForm';
import { buildPath, ROUTES } from '@/shared/constants/routes';
import { Card, ErrorState, PageHeader, PageLoader } from '@/shared/ui';
import styles from './SettingsPage.module.css';

/** Settings section: organization profile + entry points to per-branch settings. */
export function SettingsPage() {
  const { t } = useTranslation('settings');
  const organization = useOrganization();
  const branches = useBranches();

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <div className={styles.stack}>
        {organization.isLoading && <PageLoader />}
        {organization.error && <ErrorState error={organization.error} onRetry={() => void organization.refetch()} />}
        {organization.data && <OrganizationForm key={organization.data.id} organization={organization.data} />}
        <Card title={t('branchSettings.title')} flush>
          {branches.error && <ErrorState compact error={branches.error} onRetry={() => void branches.refetch()} />}
          <ul className={styles.list}>
            {(branches.data ?? []).map((branch) => (
              <li key={branch.id}>
                <Link to={buildPath(ROUTES.admin.branchSettings, { branchId: branch.id })} className={styles.link}>
                  <span>
                    <strong>{branch.name}</strong>
                    <small className={styles.muted}>{t('branchSettings.hint')}</small>
                  </span>
                  <ChevronRight aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
