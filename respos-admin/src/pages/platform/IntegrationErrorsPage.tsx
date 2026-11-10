import { useTranslation } from 'react-i18next';
import { IntegrationErrorsTable } from '@/features/integrations/ui/IntegrationErrorsTable';
import { PageHeader } from '@/shared/ui';

/** Platform → integration errors of all organizations (messages only — no secrets or payloads). */
export function IntegrationErrorsPage() {
  const { t } = useTranslation('integrations');
  return (
    <>
      <PageHeader title={t('errors.platformTitle')} description={t('errors.platformSubtitle')} />
      <IntegrationErrorsTable scope="platform" />
    </>
  );
}
