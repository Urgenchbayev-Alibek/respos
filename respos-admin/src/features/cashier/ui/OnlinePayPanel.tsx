import { ExternalLink, QrCode as QrIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCancelPaymentIntent,
  useCreatePaymentIntent,
  usePaymentIntent,
  usePaymentProviders,
} from '@/entities/billing/billing.queries';
import type { OrderBillDto, PaymentProviderDto } from '@/entities/billing/billing.types';
import type { PayableOrderDto } from '@/entities/payment/payable-order.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, DemoBadge, Spinner } from '@/shared/ui';
import { QrCode } from '@/shared/ui/QrCode/QrCode';
import styles from './OnlinePayPanel.module.css';

interface OnlinePayPanelProps {
  order: PayableOrderDto;
  bill?: OrderBillDto | null;
}

/** Customer pays by QR / link through an enabled provider; status is polled until the provider callback confirms it. */
export function OnlinePayPanel({ order, bill = null }: OnlinePayPanelProps) {
  const { t } = useTranslation('billing');
  const providers = usePaymentProviders();
  const create = useCreatePaymentIntent();
  const cancel = useCancelPaymentIntent();
  const [intentId, setIntentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intent = usePaymentIntent(intentId);

  useEffect(() => {
    setIntentId(null);
    setError(null);
  }, [order.id, bill?.id]);

  const start = async (provider: string) => {
    setError(null);
    try {
      const created = await create.mutateAsync({ orderId: order.id, provider, tipAmount: 0, ...(bill ? { billId: bill.id } : {}) });
      setIntentId(created.id);
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  };

  const onCancel = async () => {
    if (!intentId) return;
    try {
      await cancel.mutateAsync(intentId);
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  };

  if (providers.isPending) return <Spinner size="sm" />;
  if (providers.isError) return null;
  const list = providers.data ?? [];
  const current = intent.data;
  const active = current?.status === 'pending' && !current.isExpired;

  return (
    <section className={styles.panel} aria-labelledby="online-pay-title">
      <h3 id="online-pay-title" className={styles.title}>
        {t('online.title')}
      </h3>
      {error && <Alert>{error}</Alert>}
      <ul className={styles.providers}>
        {list.map((provider) => (
          <li key={provider.code} className={styles.provider}>
            <span className={styles.name}>{t(`providers.${provider.code}`, { defaultValue: provider.code })}</span>
            {provider.isAvailable ? (
              <Button size="sm" icon={<QrIcon />} disabled={active} loading={create.isPending} onClick={() => void start(provider.code)}>
                {t('online.createLink', { provider: t(`providers.${provider.code}`, { defaultValue: provider.code }) })}
              </Button>
            ) : (
              <ProviderUnavailable provider={provider} />
            )}
          </li>
        ))}
      </ul>
      {!list.some((p) => p.isAvailable) && <p className={styles.muted}>{t('online.noneAvailable')}</p>}
      {current && <IntentStatus intent={current} cancelling={cancel.isPending} onCancel={() => void onCancel()} />}
    </section>
  );
}

function ProviderUnavailable({ provider }: { provider: PaymentProviderDto }) {
  const { t } = useTranslation('billing');
  if (!provider.isImplemented) return <DemoBadge kind="not-connected" title={t('settings.skeletonHint')} />;
  if (provider.status === 'not_connected') return <DemoBadge kind="not-connected" title={t('online.status.not_connected')} />;
  return <span className={styles.muted}>{t('online.disabled')}</span>;
}

interface IntentStatusProps {
  intent: NonNullable<ReturnType<typeof usePaymentIntent>['data']>;
  cancelling: boolean;
  onCancel: () => void;
}

function IntentStatus({ intent, cancelling, onCancel }: IntentStatusProps) {
  const { t } = useTranslation('billing');
  const format = useFormatters();
  const providerName = t(`providers.${intent.provider}`, { defaultValue: intent.provider });

  if (intent.status === 'completed') return <Alert tone="success">{t('online.completed')}</Alert>;
  if (intent.status === 'cancelled') return <p className={styles.muted} role="status">{t('online.cancelled')}</p>;
  if (intent.isExpired) return <p className={styles.muted} role="status">{t('online.expired')}</p>;

  return (
    <div className={styles.intent} data-testid="payment-intent">
      {intent.paymentUrl && <QrCode value={intent.paymentUrl} alt={t('online.qrAlt', { provider: providerName })} className={styles.qr} />}
      <div className={styles.intentInfo}>
        <strong>{t('online.amount', { amount: format.money(intent.totalAmount) })}</strong>
        <p className={styles.waiting} role="status">
          <Spinner size="sm" /> {t('online.waiting')}
        </p>
        {intent.paymentUrl && (
          <a href={intent.paymentUrl} target="_blank" rel="noreferrer noopener" className={styles.link}>
            <ExternalLink aria-hidden="true" size={16} /> {t('online.openLink')}
          </a>
        )}
        <Button size="sm" variant="ghost" loading={cancelling} onClick={onCancel}>
          {t('online.cancel')}
        </Button>
      </div>
    </div>
  );
}
