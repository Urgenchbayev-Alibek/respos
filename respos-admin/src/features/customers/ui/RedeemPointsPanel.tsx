import { Star } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCancelRedemption, useOrderLoyalty, useRedeemPoints } from '@/entities/customer/customer.queries';
import { isOrderOpen, type OrderDto } from '@/entities/order/order.types';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, Input, Spinner } from '@/shared/ui';
import styles from './RedeemPointsPanel.module.css';

/** Cashier: pay part of the bill with the guest's loyalty points (server enforces balance and max % of bill). */
export function RedeemPointsPanel({ order }: { order: OrderDto }) {
  const { t } = useTranslation('customers');
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const canRedeem = hasPermission(PERMISSIONS.customers.loyaltyRedeem);
  const visible = canRedeem && Boolean(order.customer) && isOrderOpen(order);
  const loyalty = useOrderLoyalty(order.id, visible);
  const redeem = useRedeemPoints();
  const cancel = useCancelRedemption();
  const [points, setPoints] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;
  if (loyalty.isPending) return <Spinner />;
  if (loyalty.isError || !loyalty.data.isEnabled) return null;
  const info = loyalty.data;
  const redeemed = order.loyaltyDiscountAmount ?? 0;

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      setPoints('');
    } catch (caught) {
      setError(getErrorMessage(caught, t));
    }
  };

  const value = Number(points);
  const valid = Number.isInteger(value) && value > 0 && value <= info.maxRedeemable;
  return (
    <section className={styles.panel} aria-label={t('redeem.title')}>
      <h3 className={styles.title}>
        <Star aria-hidden="true" className={styles.icon} /> {t('redeem.title')}
      </h3>
      <p className={styles.meta}>
        {t('redeem.balance', { points: format.number(info.points, 0) })} · {t('redeem.max', { points: format.number(info.maxRedeemable, 0) })}
      </p>
      {error && <Alert>{error}</Alert>}
      {redeemed > 0 ? (
        <div className={styles.row}>
          <span>{t('redeem.applied', { amount: format.money(redeemed) })}</span>
          <Button loading={cancel.isPending} onClick={() => void run(() => cancel.mutateAsync(order.id))}>
            {t('redeem.cancel')}
          </Button>
        </div>
      ) : info.maxRedeemable > 0 ? (
        <div className={styles.row}>
          <FormField label={t('redeem.points')} className={styles.field}>
            <Input type="number" inputMode="numeric" min={1} max={info.maxRedeemable} step={1} value={points} onChange={(e) => setPoints(e.target.value)} />
          </FormField>
          <Button onClick={() => setPoints(String(info.maxRedeemable))}>{t('redeem.useMax')}</Button>
          <Button
            variant="primary"
            disabled={!valid}
            loading={redeem.isPending}
            onClick={() => void run(() => redeem.mutateAsync({ orderId: order.id, points: value }))}
          >
            {t('redeem.apply')}
          </Button>
        </div>
      ) : (
        <p className={styles.meta}>{t('redeem.unavailable')}</p>
      )}
      {info.expectedEarn > 0 && <p className={styles.meta}>{t('redeem.willEarn', { points: format.number(info.expectedEarn, 0) })}</p>}
    </section>
  );
}
