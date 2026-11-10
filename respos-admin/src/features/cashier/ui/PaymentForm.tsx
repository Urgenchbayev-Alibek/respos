import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { OrderBillDto } from '@/entities/billing/billing.types';
import type { PayableOrderDto } from '@/entities/payment/payable-order.types';
import { useCreatePayment } from '@/entities/payment/payment.queries';
import { PAYMENT_METHODS, type CreatePaymentInput, type PaymentDto } from '@/entities/payment/payment.types';
import { moneyField } from '@/features/payments/model/money-field';
import { isUncertainFailure, useIdempotentSubmit } from '@/features/payments/model/use-idempotent-submit';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, DemoBadge, FormField, MoneyInput } from '@/shared/ui';
import styles from './PaymentForm.module.css';

function paymentSchema(remaining: number) {
  return z.object({
    method: z.enum(PAYMENT_METHODS),
    amount: moneyField({ positive: true, max: remaining, maxMessage: 'cashier:pay.exceedsRemaining' }),
    received: moneyField({ optional: true }),
    tip: moneyField({ optional: true }),
  });
}
type PaymentValues = z.input<ReturnType<typeof paymentSchema>>;

interface PaymentFormProps {
  order: PayableOrderDto;
  onPaid: (payment: PaymentDto) => void;
  /** F2: bill of a split order — limits the amount and is sent as `billId`. */
  bill?: OrderBillDto | null;
}

/** Take a payment: method, amount (default = remaining of the order or bill), tip, cash change (info only), Idempotency-Key. */
export function PaymentForm({ order, onPaid, bill = null }: PaymentFormProps) {
  const { t } = useTranslation('cashier');
  const due = bill ? bill.remainingAmount : order.remainingAmount;
  const format = useFormatters();
  const { mutateAsync } = useCreatePayment();
  const [serverError, setServerError] = useState<{ message: string; retry: boolean } | null>(null);
  const schema = useMemo(() => paymentSchema(due), [due]);
  const { control, handleSubmit, setValue, reset, setError, formState } = useForm<PaymentValues>({
    resolver: zodResolver(schema),
    defaultValues: { method: 'cash', amount: due, received: null, tip: null },
  });
  const [method, amount, received, tip] = useWatch({ control, name: ['method', 'amount', 'received', 'tip'] });

  const run = useCallback(
    (input: CreatePaymentInput, idempotencyKey: string) => mutateAsync({ input, idempotencyKey }),
    [mutateAsync],
  );
  const { submit, pending, reset: newAction } = useIdempotentSubmit(run);

  useEffect(() => {
    reset({ method: 'cash', amount: due, received: null, tip: null });
    setServerError(null);
    newAction();
  }, [order.id, bill?.id, due, reset, newAction]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const payment = await submit({
        orderId: order.id,
        method: values.method,
        amount: values.amount ?? 0,
        ...(bill ? { billId: bill.id } : {}),
        ...(values.tip ? { tipAmount: values.tip } : {}),
      });
      if (payment) onPaid(payment);
    } catch (error) {
      if (applyServerFieldErrors(error, setError, ['amount', 'method', 'tip'])) return;
      setServerError({ message: getErrorMessage(error, t), retry: isUncertainFailure(error) });
    }
  });

  const payable = (amount ?? 0) + (tip ?? 0);
  const change = method === 'cash' && received !== null && amount !== null ? received - payable : null;

  return (
    <form className={styles.form} onSubmit={(event) => void onSubmit(event)} noValidate aria-busy={pending}>
      <div className={styles.provider}>
        <span>{t('pay.provider')}</span>
        <strong>{t('pay.manualProvider')}</strong>
        <DemoBadge title={t('pay.providerHint')} />
      </div>
      {serverError && <Alert>{serverError.retry ? `${serverError.message} ${t('pay.retrySafe')}` : serverError.message}</Alert>}
      <Controller
        control={control}
        name="method"
        render={({ field }) => (
          <div className={styles.methods} role="group" aria-label={t('pay.method')}>
            {PAYMENT_METHODS.map((value, index) => (
              <button
                key={value}
                type="button"
                data-shortcut={`pay-method-${index + 1}`}
                className={styles.method}
                aria-pressed={field.value === value}
                disabled={pending}
                onClick={() => field.onChange(value)}
              >
                {t(`payments:methods.${value}`)}
              </button>
            ))}
          </div>
        )}
      />
      <FormField label={t('pay.amount')} hint={t('pay.amountHint')} error={formState.errors.amount?.message} required>
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} currency={format.currency} disabled={pending} />
          )}
        />
      </FormField>
      <div className={styles.quick}>
        <Button size="sm" onClick={() => setValue('amount', due, { shouldValidate: true })} disabled={pending}>
          {t('pay.fullRemaining')}
        </Button>
      </div>
      <FormField label={t('billing:tip.label')} hint={t('billing:tip.hint')} error={formState.errors.tip?.message}>
        <Controller
          control={control}
          name="tip"
          render={({ field }) => (
            <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} currency={format.currency} disabled={pending} />
          )}
        />
      </FormField>
      {Boolean(tip) && <p className={styles.disclaimer}>{t('billing:tip.total', { amount: format.money(payable) })}</p>}
      {method === 'cash' && (
        <>
          <FormField label={t('pay.received')} error={formState.errors.received?.message}>
            <Controller
              control={control}
              name="received"
              render={({ field }) => (
                <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} currency={format.currency} />
              )}
            />
          </FormField>
          {change !== null && (
            <div className={styles.change} role="status" data-testid="cash-change">
              <span>{change >= 0 ? t('pay.change') : t('pay.notEnough')}</span>
              <strong>{format.money(Math.abs(change))}</strong>
            </div>
          )}
        </>
      )}
      <Button type="submit" variant="primary" size="lg" fullWidth loading={pending} data-shortcut="pay-submit">
        {t('pay.submit', { amount: format.money(amount) })}
      </Button>
      <p className={styles.disclaimer}>{t('pay.disclaimer')}</p>
    </form>
  );
}
