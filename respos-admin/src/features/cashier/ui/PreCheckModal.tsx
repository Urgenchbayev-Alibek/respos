import { Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOrderReceipt } from '@/entities/order/order.queries';
import type { ReceiptDto } from '@/entities/order/receipt.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Button, ErrorState, Modal, PageLoader, PrintArea, printArea } from '@/shared/ui';
import { orderPlaceLabel } from '../model/order-place';
import { OrderSummary } from './OrderSummary';
import styles from './PreCheckModal.module.css';

/**
 * Pre-check (guest bill) from `GET /orders/{id}/receipt` (fresh server data, cancelled items excluded).
 * NOT a fiscal receipt (no online cash register in MVP). Prints as an 80 mm thermal slip (`PrintArea`).
 */
const PRINT_ID = 'precheck';

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
          <Button variant="primary" icon={<Printer />} disabled={!receipt.data} onClick={() => printArea(PRINT_ID)}>
            {t('ux:print.precheck')}
          </Button>
        </>
      }
    >
      {receipt.isPending ? (
        <PageLoader />
      ) : receipt.isError ? (
        <ErrorState error={receipt.error} onRetry={() => void receipt.refetch()} />
      ) : (
        <>
          <ReceiptSheet receipt={receipt.data} testId="precheck" />
          <PrintArea id={PRINT_ID} defaultForPrint>
            <ReceiptSheet receipt={receipt.data} />
          </PrintArea>
        </>
      )}
    </Modal>
  );
}

function ReceiptSheet({ receipt, testId }: { receipt: ReceiptDto; testId?: string }) {
  const { t } = useTranslation('cashier');
  const format = useFormatters();
  const place = orderPlaceLabel(receipt, t);
  const contacts = [receipt.branchAddress, receipt.branchPhone].filter(Boolean).join(' · ');

  return (
    <div className={styles.sheet} data-testid={testId}>
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
