import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OrderDto } from '@/entities/order/order.types';
import { Button, Input } from '@/shared/ui';
import styles from './SplitBill.module.css';

const MAX_NEW_BILLS = 19;

interface ItemsSplitEditorProps {
  order: OrderDto;
  /** One record per new bill: orderItemId → quantity moved to it. */
  allocations: Record<string, number>[];
  onChange: (allocations: Record<string, number>[]) => void;
}

/** Quantities per item for each new bill; whatever is left forms the last bill (server rule). */
export function ItemsSplitEditor({ order, allocations, onChange }: ItemsSplitEditorProps) {
  const { t } = useTranslation('billing');
  const items = order.items.filter((item) => item.status !== 'cancelled');

  const allocatedElsewhere = (itemId: string, billIndex: number) =>
    allocations.reduce((sum, bill, index) => (index === billIndex ? sum : sum + (bill[itemId] ?? 0)), 0);

  const setQuantity = (billIndex: number, itemId: string, raw: string, max: number) => {
    const parsed = Number(raw.replace(',', '.'));
    const quantity = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), max) : 0;
    onChange(allocations.map((bill, index) => (index === billIndex ? { ...bill, [itemId]: quantity } : bill)));
  };

  const nothingAllocated = allocations.every((bill) => Object.values(bill).every((quantity) => !quantity));

  return (
    <div className={styles.body}>
      <p className={styles.muted}>{t('split.itemsHint')}</p>
      {allocations.map((bill, billIndex) => (
        <fieldset key={billIndex} className={styles.bill}>
          <legend>{t('split.bill', { number: billIndex + 1 })}</legend>
          {items.map((item) => {
            const max = Math.max(0, item.quantity - allocatedElsewhere(item.id, billIndex));
            return (
              <label key={item.id} className={styles.itemRow}>
                <span className={styles.grow}>
                  {item.name}
                  {item.variantName ? ` · ${item.variantName}` : ''}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={max}
                  step="any"
                  className={styles.qty}
                  aria-label={t('split.quantityFor', { name: item.name, number: billIndex + 1 })}
                  value={bill[item.id] ? String(bill[item.id]) : ''}
                  onChange={(event) => setQuantity(billIndex, item.id, event.target.value, max)}
                />
                <small className={styles.muted}>{t('split.available', { quantity: item.quantity })}</small>
              </label>
            );
          })}
        </fieldset>
      ))}
      {allocations.length < MAX_NEW_BILLS && (
        <Button size="sm" icon={<Plus />} onClick={() => onChange([...allocations, {}])}>
          {t('split.addBill')}
        </Button>
      )}
      <p className={nothingAllocated ? styles.warning : styles.muted} role="status">
        {nothingAllocated ? t('split.nothingAllocated') : t('split.restBill')}
      </p>
    </div>
  );
}
