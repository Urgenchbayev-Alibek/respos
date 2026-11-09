import { Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PaymentDto } from '@/entities/payment/payment.types';
import { getRefundable } from '@/features/payments/model/payment-labels';
import { RefundModal } from '@/features/payments/ui/RefundModal';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { Button, StatusBadge } from '@/shared/ui';
import styles from './OrderPaymentsList.module.css';

/** Partial payments of one order with refund action. */
export function OrderPaymentsList({ payments }: { payments: PaymentDto[] }) {
  const { t } = useTranslation('cashier');
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const canRefund = hasPermission(PERMISSIONS.payments.refund);
  const [refunding, setRefunding] = useState<PaymentDto | null>(null);

  if (payments.length === 0) return <p className={styles.muted}>{t('orderPayments.empty')}</p>;
  return (
    <>
      <ul className={styles.list}>
        {payments.map((payment) => (
          <li key={payment.id} className={styles.row}>
            <span className={styles.info}>
              <span className={styles.muted}>{format.time(payment.createdAt)}</span>
              <span>{t(`payments:methods.${payment.method}`)}</span>
              <StatusBadge domain="payment" status={payment.status} />
              {payment.refundedAmount > 0 && (
                <span className={styles.muted}>{t('orderPayments.refunded', { amount: format.money(payment.refundedAmount) })}</span>
              )}
            </span>
            <span className={styles.amount}>{format.money(payment.amount)}</span>
            {canRefund && getRefundable(payment) > 0 && (
              <Button size="sm" variant="ghost" icon={<Undo2 />} onClick={() => setRefunding(payment)}>
                {t('payments:refund.action')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {refunding && <RefundModal payment={refunding} onClose={() => setRefunding(null)} />}
    </>
  );
}
