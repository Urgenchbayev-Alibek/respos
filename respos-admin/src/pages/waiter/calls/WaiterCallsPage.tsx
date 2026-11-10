import { BellRing, Check, Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAcknowledgeWaiterCall, useWaiterCalls } from '@/entities/waiter-call/waiter-call.queries';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Button, Card, EmptyState, ErrorState, PageHeader, PageLoader, StatusBadge, useToast } from '@/shared/ui';

/** Waiter: active guest calls from table QR menus (oldest first) with "on my way" acknowledge. */
export function WaiterCallsPage() {
  const { t } = useTranslation('qrMenu');
  const format = useFormatters();
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const canAcknowledge = hasPermission(PERMISSIONS.orders.update);
  const calls = useWaiterCalls();
  const acknowledge = useAcknowledgeWaiterCall();

  const onAcknowledge = async (id: string) => {
    try {
      await acknowledge.mutateAsync(id);
    } catch (error) {
      toast.error(getErrorMessage(error, t));
    }
  };

  return (
    <>
      <PageHeader title={t('calls.title')} description={t('calls.subtitle')} />
      {calls.isLoading && <PageLoader />}
      {calls.error && <ErrorState error={calls.error} onRetry={() => void calls.refetch()} />}
      {calls.data?.length === 0 && <EmptyState icon={<BellRing />} title={t('calls.empty')} />}
      {calls.data && calls.data.length > 0 && (
        <Card flush>
          <ul aria-label={t('calls.title')} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {calls.data.map((call) => (
              <li
                key={call.id}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)' }}
              >
                {call.reason === 'bill' ? <Receipt aria-hidden="true" /> : <BellRing aria-hidden="true" />}
                <strong>{t('calls.table', { number: call.tableNumber })}</strong>
                <StatusBadge size="sm" tone={call.reason === 'bill' ? 'primary' : 'warning'}>
                  {t(`calls.reason.${call.reason}`)}
                </StatusBadge>
                <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)' }}>{format.time(call.createdAt)}</span>
                {canAcknowledge && (
                  <Button size="lg" icon={<Check />} loading={acknowledge.isPending && acknowledge.variables === call.id} onClick={() => void onAcknowledge(call.id)}>
                    {t('calls.acknowledge')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
