import { Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PayableOrderDto } from '@/entities/payment/payable-order.types';
import { formatOrderNumber } from '@/features/payments/model/payment-labels';
import { useAuth } from '@/shared/hooks/use-auth';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Button, Modal } from '@/shared/ui';
import { OrderSummary } from './OrderSummary';
import styles from './PreCheckModal.module.css';

/** Pre-check (guest bill) from server data. NOT a fiscal receipt (no online cash register in MVP). */
export function PreCheckModal({ order, onClose }: { order: PayableOrderDto; onClose: () => void }) {
  const { t } = useTranslation('cashier');
  const format = useFormatters();
  const { user } = useAuth();
  const { branch } = useCurrentBranch();
  const place = order.tableNumber ? t('orders.table', { number: order.tableNumber }) : t('orders.takeaway');

  return (
    <Modal
      open
      onClose={onClose}
      title={t('precheck.title')}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.close')}</Button>
          <Button variant="primary" icon={<Printer />} onClick={() => window.print()}>
            {t('precheck.print')}
          </Button>
        </>
      }
    >
      <div className={styles.sheet} data-testid="precheck">
        <div className={styles.header}>
          <h3>{user?.currentOrganization?.name}</h3>
          {branch && <p className={styles.meta}>{branch.name}</p>}
        </div>
        <p className={styles.notFiscal}>{t('precheck.notFiscal')}</p>
        <p className={styles.meta}>
          {t('precheck.meta', {
            number: formatOrderNumber(order.number),
            place,
            waiter: order.waiterName ?? '—',
            time: format.dateTime(order.openedAt),
          })}
        </p>
        <OrderSummary order={order} />
        <p className={styles.meta}>{t('precheck.printedAt', { time: format.dateTime(new Date()) })}</p>
      </div>
    </Modal>
  );
}
