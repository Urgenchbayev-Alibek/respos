import { Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOrderReceipt } from '@/entities/order/order.queries';
import type { ReceiptDto } from '@/entities/order/receipt.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Button, ErrorState, Modal, PageLoader } from '@/shared/ui';
import { OrderSummary } from './OrderSummary';
import styles from './PreCheckModal.module.css';

/**
 * Pre-check (guest bill) from `GET /orders/{id}/receipt` (fresh server data, cancelled items excluded).
 * NOT a fiscal receipt (no online cash register in MVP).
 */
export function PreCheckModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { t } = useTranslation('cashier');
  const receipt = useOrderReceipt(orderId);

  return (
    <Modal
      open
      onClose={onClose}
      title={t('precheck.title')}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.close')}</Button>
          <Button variant="primary" icon={<Printer />} disabled={!receipt.data} onClick={() => window.print()}>
            {t('precheck.print')}
          </Button>
        </>
      }
    >
      {receipt.isPending ? (
        <PageLoader />
      ) : receipt.isError ? (
        <ErrorState error={receipt.error} onRetry={() => void receipt.refetch()} />
      ) : (
        <ReceiptSheet receipt={receipt.data} />
      )}
    </Modal>
  );
}

function ReceiptSheet({ receipt }: { receipt: ReceiptDto }) {
  const { t } = useTranslation('cashier');
  const format = useFormatters();
  const place = receipt.tableNumber ? t('orders.table', { number: receipt.tableNumber }) : t('orders.takeaway');
  const contacts = [receipt.branchAddress, receipt.branchPhone].filter(Boolean).join(' · ');

  return (
    <div className={styles.sheet} data-testid="precheck">
      <div className={styles.header}>
        <h3>{receipt.organizationName}</h3>
        <p className={styles.meta}>{receipt.branchName}</p>
        {contacts && <p className={styles.meta}>{contacts}</p>}
      </div>
      <p className={styles.notFiscal}>{t('precheck.notFiscal')}</p>
      <p className={styles.meta}>
        {t('precheck.meta', {
          number: receipt.displayNumber,
          place,
          waiter: receipt.waiterName ?? '—',
          time: format.dateTime(receipt.openedAt),
        })}
      </p>
      <OrderSummary order={receipt} />
      {receipt.footer && <p className={styles.meta}>{receipt.footer}</p>}
      <p className={styles.meta}>{t('precheck.printedAt', { time: format.dateTime(receipt.printedAt) })}</p>
    </div>
  );
}
