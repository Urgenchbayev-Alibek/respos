import { Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { PaymentPanel } from '@/features/cashier/ui/PaymentPanel';
import { PayableOrderList } from '@/features/cashier/ui/PayableOrderList';
import { ShiftBanner } from '@/features/cash-shifts/ui/ShiftBanner';
import { BREAKPOINTS, useMediaQuery } from '@/shared/hooks/use-media-query';
import { EmptyState } from '@/shared/ui';
import styles from './CashierOrdersPage.module.css';
import { useCashierRealtime } from './use-cashier-realtime';

/** Cashier home: shift banner, orders awaiting payment, payment panel (`?orderId=`). */
export function CashierOrdersPage() {
  const { t } = useTranslation('cashier');
  const [searchParams, setSearchParams] = useSearchParams();
  const isNarrow = useMediaQuery(BREAKPOINTS.tabletDown);
  const orderId = searchParams.get('orderId');
  useCashierRealtime();

  const select = (id: string | null) => setSearchParams(id ? { orderId: id } : {}, { replace: !id });
  const showList = !isNarrow || !orderId;
  const showPanel = !isNarrow || Boolean(orderId);

  return (
    <>
      <h1 className="visually-hidden">{t('orders.pageTitle')}</h1>
      <ShiftBanner />
      <div className={styles.split}>
        {showList && <PayableOrderList selectedId={orderId} onSelect={select} />}
        {showPanel &&
          (orderId ? (
            <PaymentPanel orderId={orderId} onBack={isNarrow ? () => select(null) : undefined} />
          ) : (
            <EmptyState icon={<Receipt />} title={t('orders.selectTitle')} description={t('orders.selectDescription')} />
          ))}
      </div>
    </>
  );
}
