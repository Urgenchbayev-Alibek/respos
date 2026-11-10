import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useBranches, useBranchSettings } from '@/entities/branch/branch.queries';
import { BranchSettingsForm } from '@/features/branches/ui/BranchSettingsForm';
import { DeliverySettingsCard } from '@/features/delivery/ui/DeliverySettingsCard';
import { ROUTES } from '@/shared/constants/routes';
import { ErrorState, PageHeader, PageLoader } from '@/shared/ui';

export function BranchSettingsPage() {
  const { t } = useTranslation('branches');
  const { branchId = '' } = useParams();
  const branches = useBranches();
  const settings = useBranchSettings(branchId);
  const branch = branches.data?.find((item) => item.id === branchId);

  return (
    <>
      <PageHeader
        back={
          <Link to={ROUTES.admin.branches}>
            <ArrowLeft size={14} aria-hidden="true" /> {t('backToBranches')}
          </Link>
        }
        title={t('settings.title')}
        description={branch?.name}
      />
      {settings.isLoading && <PageLoader />}
      {settings.error && <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />}
      {settings.data && <BranchSettingsForm key={branchId} branchId={branchId} settings={settings.data} />}
      {settings.data && <DeliverySettingsCard branchId={branchId} />}
    </>
  );
}
