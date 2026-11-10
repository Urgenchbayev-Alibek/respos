import { useTranslation } from 'react-i18next';
import { useIntegrations } from '@/entities/integration/integration.queries';
import { IntegrationCard } from '@/features/integrations/ui/IntegrationCard';
import styles from '@/features/integrations/ui/integrations.module.css';
import { ROUTES } from '@/shared/constants/routes';
import { ErrorState, PageHeader, PageLoader, Tabs } from '@/shared/ui';

export function IntegrationTabs() {
  const { t } = useTranslation('integrations');
  return (
    <Tabs
      ariaLabel={t('title')}
      items={[
        { id: 'settings', label: t('tabs.settings'), to: ROUTES.admin.integrations },
        { id: 'outbound', label: t('tabs.outbound'), to: ROUTES.admin.integrationsOutbound },
      ]}
    />
  );
}

/** Telegram / Eskiz SMS / SMTP settings (integrations.manage). Disabled unless configured — no fake success. */
export function IntegrationsPage() {
  const { t } = useTranslation('integrations');
  const integrations = useIntegrations();

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <IntegrationTabs />
      {integrations.isLoading && <PageLoader />}
      {integrations.error && <ErrorState error={integrations.error} onRetry={() => void integrations.refetch()} />}
      <div className={styles.grid}>
        {(integrations.data ?? []).map((integration) => (
          <IntegrationCard key={`${integration.type}-${integration.updatedAt ?? 'new'}`} integration={integration} />
        ))}
      </div>
    </>
  );
}
