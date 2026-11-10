import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSplitOrder } from '@/entities/billing/billing.queries';
import type { BillSplitMode, SplitOrderInput } from '@/entities/billing/billing.types';
import { formatOrderNumber, type OrderDto } from '@/entities/order/order.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, IconButton, Input, Modal, MoneyInput, Tabs, useToast } from '@/shared/ui';
import { amountsMatchTotal, buildItemsSplit, previewEqualSplit, sumMoney } from '../model/split-math';
import { ItemsSplitEditor } from './ItemsSplitEditor';
import styles from './SplitBill.module.css';

const MAX_BILLS = 20;

/** Split an order into bills: equally, by items (partial quantities) or custom amounts. The server result wins. */
export function SplitBillModal({ order, onClose }: { order: OrderDto; onClose: () => void }) {
  const { t } = useTranslation('billing');
  const format = useFormatters();
  const toast = useToast();
  const split = useSplitOrder();
  const [mode, setMode] = useState<BillSplitMode>('equal');
  const [parts, setParts] = useState('2');
  const [amounts, setAmounts] = useState<(number | null)[]>(() => previewEqualSplit(order.total, 2));
  const [allocations, setAllocations] = useState<Record<string, number>[]>([{}]);
  const [error, setError] = useState<string | null>(null);

  const partsNumber = Number(parts);
  const equalPreview = useMemo(() => previewEqualSplit(order.total, partsNumber), [order.total, partsNumber]);
  const itemsInput = useMemo(() => buildItemsSplit(allocations), [allocations]);
  const input: SplitOrderInput | null =
    mode === 'equal'
      ? equalPreview.length > 0 ? { mode, parts: partsNumber } : null
      : mode === 'custom'
        ? amountsMatchTotal(amounts, order.total) ? { mode, amounts: amounts as number[] } : null
        : itemsInput.mode === 'items' && itemsInput.bills.length > 0 ? itemsInput : null;

  const submit = async () => {
    if (!input) return;
    setError(null);
    try {
      await split.mutateAsync({ orderId: order.id, input });
      toast.success(t('split.done'));
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  };

  const setAmount = (index: number, value: number | null) =>
    setAmounts((current) => current.map((amount, i) => (i === index ? value : amount)));

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={t('split.title', { number: formatOrderNumber(order.number) })}
      description={t('split.description', { total: format.money(order.total) })}
      dismissible={!split.isPending}
      footer={
        <>
          <Button onClick={onClose} disabled={split.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!input} loading={split.isPending}>
            {t('split.submit')}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        {error && <Alert>{error}</Alert>}
        <Tabs
          ariaLabel={t('split.modeLabel')}
          value={mode}
          onChange={(id) => setMode(id as BillSplitMode)}
          items={(['equal', 'items', 'custom'] as const).map((id) => ({ id, label: t(`split.modes.${id}`) }))}
        />
        {mode === 'equal' && (
          <>
            <FormField label={t('split.parts')} required>
              <Input type="number" min={2} max={MAX_BILLS} step={1} value={parts} onChange={(e) => setParts(e.target.value)} />
            </FormField>
            {equalPreview.length > 0 && (
              <p className={styles.muted} data-testid="split-preview">
                {t('split.preview', { amounts: equalPreview.map((a) => format.money(a)).join(' · ') })}
              </p>
            )}
          </>
        )}
        {mode === 'custom' && (
          <>
            {amounts.map((amount, index) => (
              <div key={index} className={styles.row}>
                <FormField label={t('split.bill', { number: index + 1 })} className={styles.grow}>
                  <MoneyInput value={amount} onChange={(value) => setAmount(index, value)} currency={format.currency} />
                </FormField>
                {amounts.length > 2 && (
                  <IconButton
                    icon={<X />}
                    label={t('split.removeBill', { number: index + 1 })}
                    onClick={() => setAmounts((current) => current.filter((_, i) => i !== index))}
                  />
                )}
              </div>
            ))}
            {amounts.length < MAX_BILLS && (
              <Button size="sm" icon={<Plus />} onClick={() => setAmounts((current) => [...current, null])}>
                {t('split.addBill')}
              </Button>
            )}
            <p className={amountsMatchTotal(amounts, order.total) ? styles.muted : styles.warning} role="status">
              {t('split.amountsSum', { sum: format.money(sumMoney(amounts)), total: format.money(order.total) })}
              {!amountsMatchTotal(amounts, order.total) && ` · ${t('split.mismatch')}`}
            </p>
          </>
        )}
        {mode === 'items' && <ItemsSplitEditor order={order} allocations={allocations} onChange={setAllocations} />}
      </div>
    </Modal>
  );
}
