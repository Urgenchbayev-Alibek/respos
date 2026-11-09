import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useReceivePurchase } from '@/entities/purchase/purchase.queries';
import type { PurchaseDto } from '@/entities/purchase/purchase.types';
import styles from '@/features/stock/ui/stock.module.css';
import { useIdempotencyKey } from '@/shared/api/idempotency';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { parseDecimal } from '@/shared/lib/quantity';
import { V } from '@/shared/lib/validation';
import { Alert, Button, Input, Modal, useToast } from '@/shared/ui';

const lineSchema = z
  .string()
  .refine((value) => value.trim() === '' || /^\d+([.,]\d{1,3})?$/.test(value.trim()), V.quantity);
const schema = z.object({ lines: z.array(z.object({ itemId: z.string(), quantity: lineSchema })) });
type Values = z.infer<typeof schema>;

const remaining = (item: { quantity: number; receivedQuantity: number }) => Math.max(0, item.quantity - item.receivedQuantity);

function toValues(purchase: PurchaseDto | null): Values {
  return { lines: (purchase?.items ?? []).map((item) => ({ itemId: item.id, quantity: String(remaining(item)) })) };
}

/**
 * Receive per line (`purchases.receive`). One Idempotency-Key per receive action: reused on retry
 * (double click / network error), renewed only after success — so a retry never doubles stock.
 */
export function ReceivePurchaseModal({ purchase, onClose }: { purchase: PurchaseDto | null; onClose: () => void }) {
  const { t } = useTranslation('purchases');
  const toast = useToast();
  const format = useFormatters();
  const receive = useReceivePurchase();
  const idempotency = useIdempotencyKey();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(purchase) });

  useEffect(() => {
    reset(toValues(purchase));
    setServerError(null);
  }, [purchase, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!purchase) return;
    setServerError(null);
    const lines = values.lines
      .map((line) => ({ itemId: line.itemId, quantity: parseDecimal(line.quantity) ?? 0 }))
      .filter((line) => line.quantity > 0);
    if (lines.length === 0) {
      setError('root', { message: 'purchases:receive.nothing' });
      return;
    }
    try {
      await receive.mutateAsync({ id: purchase.id, input: { lines }, idempotencyKey: idempotency.key });
      idempotency.renew();
      toast.success(t('receive.done'));
      onClose();
    } catch (error) {
      setServerError(getErrorMessage(error, t));
    }
  });

  const items = purchase?.items ?? [];
  return (
    <Modal
      open={purchase !== null}
      onClose={onClose}
      size="lg"
      dismissible={!formState.isSubmitting}
      title={t('receive.title', { number: purchase?.number ?? '' })}
      description={t('receive.description')}
      footer={
        <>
          <Button onClick={onClose} disabled={formState.isSubmitting}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" type="submit" form="receive-form" loading={formState.isSubmitting}>{t('receive.submit')}</Button>
        </>
      }
    >
      <form id="receive-form" noValidate onSubmit={onSubmit} className={styles.stack}>
        {serverError && <Alert>{serverError}</Alert>}
        {formState.errors.root?.message && <Alert>{t(formState.errors.root.message)}</Alert>}
        <div className={styles.linesScroll}>
          <table className={styles.linesTable}>
            <thead>
              <tr>
                <th scope="col">{t('columns.ingredient')}</th>
                <th scope="col">{t('columns.ordered')}</th>
                <th scope="col">{t('columns.received')}</th>
                <th scope="col">{t('columns.receiveNow')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const error = formState.errors.lines?.[index]?.quantity?.message;
                return (
                  <tr key={item.id}>
                    <td>{item.ingredientName}</td>
                    <td className={styles.num}>{format.number(item.quantity)} {item.unitCode}</td>
                    <td className={styles.num}>{format.number(item.receivedQuantity)} {item.unitCode}</td>
                    <td>
                      <Input
                        className={styles.lineInput}
                        inputMode="decimal"
                        aria-label={t('receive.quantityFor', { name: item.ingredientName })}
                        aria-invalid={Boolean(error) || undefined}
                        disabled={remaining(item) === 0}
                        {...register(`lines.${index}.quantity`)}
                      />
                      {error && <small role="alert" className={styles.negative}>{t(error)}</small>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </form>
    </Modal>
  );
}
