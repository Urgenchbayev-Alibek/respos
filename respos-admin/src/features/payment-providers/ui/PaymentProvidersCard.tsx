import { useTranslation } from 'react-i18next';
import { useFiscalStatus, usePaymentProviders, useSetPaymentProvider } from '@/entities/billing/billing.queries';
import type { IntegrationStatus, PaymentProviderDto } from '@/entities/billing/billing.types';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Card, DemoBadge, ErrorState, PageLoader, Switch, useToast } from '@/shared/ui';
import styles from './PaymentProvidersCard.module.css';

const STATUS_CLASS: Record<IntegrationStatus, string | undefined> = {
  not_connected: styles.off,
  test: styles.test,
  connected: styles.on,
};

/** Payment providers of the current branch (keys only via server env) + fiscal adapter status. Honest statuses, no fake success. */
export function PaymentProvidersCard() {
  const { t } = useTranslation('billing');
  const { branch } = useCurrentBranch();
  const providers = usePaymentProviders();
  const fiscal = useFiscalStatus();

  return (
    <>
      <Card title={`${t('settings.title')}${branch ? ` · ${branch.name}` : ''}`}>
        <p className={styles.muted}>{t('settings.description')}</p>
        {providers.isPending && <PageLoader />}
        {providers.isError && <ErrorState compact error={providers.error} onRetry={() => void providers.refetch()} />}
        <ul className={styles.list}>
          {(providers.data ?? []).map((provider) => (
            <ProviderRow key={provider.code} provider={provider} />
          ))}
        </ul>
      </Card>
      <Card title={t('settings.fiscalTitle')}>
        {fiscal.isError && <ErrorState compact error={fiscal.error} onRetry={() => void fiscal.refetch()} />}
        {fiscal.data && (
          <div className={styles.row}>
            <span>{t('settings.fiscalProvider', { code: fiscal.data.code })}</span>
            <StatusLabel status={fiscal.data.status} />
          </div>
        )}
        <p className={styles.muted}>{t('settings.fiscalHint')}</p>
      </Card>
    </>
  );
}

function StatusLabel({ status }: { status: IntegrationStatus }) {
  const { t } = useTranslation('billing');
  if (status === 'not_connected') return <DemoBadge kind="not-connected" />;
  return <span className={STATUS_CLASS[status]}>{t(`online.status.${status}`)}</span>;
}

function ProviderRow({ provider }: { provider: PaymentProviderDto }) {
  const { t } = useTranslation('billing');
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const setProvider = useSetPaymentProvider();
  const name = t(`providers.${provider.code}`, { defaultValue: provider.code });
  const canToggle = hasPermission(PERMISSIONS.settings.manage) && provider.isImplemented && provider.isConfigured;

  const toggle = async (isEnabled: boolean) => {
    try {
      await setProvider.mutateAsync({ code: provider.code, isEnabled });
      toast.success(t('settings.saved'));
    } catch (error) {
      toast.error(getErrorMessage(error, t));
    }
  };

  return (
    <li className={styles.provider} data-testid={`provider-${provider.code}`}>
      <div className={styles.row}>
        <strong>{name}</strong>
        <StatusLabel status={provider.status} />
      </div>
      {!provider.isImplemented && <small className={styles.muted}>{t('settings.skeletonHint')}</small>}
      {provider.isImplemented && !provider.isConfigured && <small className={styles.muted}>{t('settings.notConfiguredHint')}</small>}
      <Switch
        checked={provider.isEnabled}
        disabled={!canToggle || setProvider.isPending}
        onChange={(checked) => void toggle(checked)}
        label={t('settings.enable', { provider: name })}
      />
      {provider.isConfigured && <small className={styles.muted}>{t('settings.callback', { path: provider.callbackPath })}</small>}
    </li>
  );
}
