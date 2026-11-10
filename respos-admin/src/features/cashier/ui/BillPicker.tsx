import { useTranslation } from 'react-i18next';
import type { OrderBillDto } from '@/entities/billing/billing.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import styles from './BillPicker.module.css';

interface BillPickerProps {
  bills: OrderBillDto[];
  selectedId: string | null;
  onSelect: (billId: string) => void;
}

/** Bills of a split order; open bills are selectable for payment. */
export function BillPicker({ bills, selectedId, onSelect }: BillPickerProps) {
  const { t } = useTranslation('billing');
  const format = useFormatters();

  return (
    <div className={styles.picker} role="group" aria-label={t('bills.chooseBill')}>
      {bills.map((bill) => {
        const paid = bill.status === 'paid';
        return (
          <button
            key={bill.id}
            type="button"
            className={styles.bill}
            aria-pressed={bill.id === selectedId}
            disabled={paid}
            onClick={() => onSelect(bill.id)}
            data-testid={`bill-${bill.number}`}
          >
            <strong>{t('bills.bill', { number: bill.number })}</strong>
            <span>{format.money(bill.amount)}</span>
            <small className={paid ? styles.paid : styles.due}>
              {paid ? t('bills.status.paid') : t('bills.remaining', { amount: format.money(bill.remainingAmount) })}
            </small>
          </button>
        );
      })}
    </div>
  );
}
