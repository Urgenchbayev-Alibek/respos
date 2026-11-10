import { ArrowLeft, Printer, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentShift } from '@/entities/cash-shift/cash-shift.queries';
import type { PayableOrderDto } from '@/entities/payment/payable-order.types';
import { usePayableOrder } from '@/entities/payment/payment.queries';
import type { PaymentDto } from '@/entities/payment/payment.types';
import { OrderGuestBar } from '@/features/customers/ui/OrderGuestBar';
import { RedeemPointsPanel } from '@/features/customers/ui/RedeemPointsPanel';
import { formatOrderNumber } from '@/features/payments/model/payment-labels';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { Alert, Button, Card, EmptyState, ErrorState, PageLoader, StatusBadge } from '@/shared/ui';
import { OrderPaymentsList } from './OrderPaymentsList';
import { OrderSummary } from './OrderSummary';
import { PaymentForm } from './PaymentForm';
import styles from './PaymentPanel.module.css';
import { PreCheckModal } from './PreCheckModal';

interface PaymentPanelProps {
  orderId: string;
  /** Shown on narrow screens where the list and the panel are not side by side. */
  onBack?: () => void;
}

export function PaymentPanel({ orderId, onBack }: PaymentPanelProps) {
  const { t } = useTranslation('cashier');
  const format = useFormatters();
  const query = usePayableOrder(orderId);
  const [lastPayment, setLastPayment] = useState<PaymentDto | null>(null);
  const [precheckOpen, setPrecheckOpen] = useState(false);

  useEffect(() => setLastPayment(null), [orderId]);

  if (query.isPending) return <PageLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const order = query.data;
  const place = order.tableNumber ? t('orders.table', { number: order.tableNumber }) : t('orders.takeaway');

  return (
    <div className={styles.panel}>
      {onBack && (
        <Button variant="ghost" icon={<ArrowLeft />} className={styles.back} onClick={onBack}>
          {t('orders.back')}
        </Button>
      )}
      <Card
        title={`${t('orders.order')} ${formatOrderNumber(order.number)} · ${place}`}
        actions={
          <Button icon={<Printer />} onClick={() => setPrecheckOpen(true)}>
            {t('precheck.open')}
          </Button>
        }
      >
        <p className={styles.meta}>
          <StatusBadge domain="order" status={order.status} />{' '}
          {t('orders.meta', { waiter: order.waiterName ?? '—', guests: order.guestCount, time: format.time(order.openedAt) })}
        </p>
        <OrderGuestBar order={order} />
        <OrderSummary order={order} />
        <h3 className={styles.section}>{t('orderPayments.title')}</h3>
        <OrderPaymentsList payments={order.payments} />
      </Card>
      <Card title={t('pay.title')}>
        <PayArea order={order} lastPayment={lastPayment} onPaid={setLastPayment} />
      </Card>
      {precheckOpen && <PreCheckModal orderId={order.id} onClose={() => setPrecheckOpen(false)} />}
    </div>
  );
}

interface PayAreaProps {
  order: PayableOrderDto;
  lastPayment: PaymentDto | null;
  onPaid: (payment: PaymentDto) => void;
}

function PayArea({ order, lastPayment, onPaid }: PayAreaProps) {
  const { t } = useTranslation('cashier');
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const shift = useCurrentShift();
  const fullyPaid = order.status === 'paid' || order.remainingAmount <= 0;
  const success = lastPayment && (
    <Alert tone="success">
      {t('pay.success', { amount: format.money(lastPayment.amount), method: t(`payments:methods.${lastPayment.method}`) })}
    </Alert>
  );

  if (fullyPaid) {
    return (
      <div className={styles.success}>
        {success}
        <Alert tone="success">{t('pay.fullyPaid')}</Alert>
      </div>
    );
  }
  if (!hasPermission(PERMISSIONS.payments.create)) return <Alert>{t('pay.noPermission')}</Alert>;
  if (shift.isPending) return <PageLoader />;
  if (!shift.data) {
    return <EmptyState compact icon={<Wallet />} title={t('pay.noShiftTitle')} description={t('pay.noShiftDescription')} />;
  }
  return (
    <div className={styles.success}>
      {success}
      <RedeemPointsPanel order={order} />
      <PaymentForm order={order} onPaid={onPaid} />
    </div>
  );
}
