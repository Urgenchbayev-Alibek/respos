import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
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
  });
}
type PaymentValues = z.input<ReturnType<typeof paymentSchema>>;

interface PaymentFormProps {
  order: PayableOrderDto;
  onPaid: (payment: PaymentDto) => void;
}

/** Take a payment: method, amount (default = remaining), cash change (info only), Idempotency-Key. */
export function PaymentForm({ order, onPaid }: PaymentFormProps) {
  const { t } = useTranslation('cashier');
  const format = useFormatters();
  const { mutateAsync } = useCreatePayment();
  const [serverError, setServerError] = useState<{ message: string; retry: boolean } | null>(null);
  const schema = useMemo(() => paymentSchema(order.remainingAmount), [order.remainingAmount]);
  const { control, handleSubmit, setValue, reset, setError, formState } = useForm<PaymentValues>({
    resolver: zodResolver(schema),
    defaultValues: { method: 'cash', amount: order.remainingAmount, received: null },
  });
  const [method, amount, received] = useWatch({ control, name: ['method', 'amount', 'received'] });

  const run = useCallback(
    (input: CreatePaymentInput, idempotencyKey: string) => mutateAsync({ input, idempotencyKey }),
    [mutateAsync],
  );
  const { submit, pending, reset: newAction } = useIdempotentSubmit(run);

  useEffect(() => {
    reset({ method: 'cash', amount: order.remainingAmount, received: null });
    setServerError(null);
    newAction();
  }, [order.id, order.remainingAmount, reset, newAction]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const payment = await submit({ orderId: order.id, method: values.method, amount: values.amount ?? 0 });
      if (payment) onPaid(payment);
    } catch (error) {
      if (applyServerFieldErrors(error, setError, ['amount', 'method'])) return;
      setServerError({ message: getErrorMessage(error, t), retry: isUncertainFailure(error) });
    }
  });

  const change = method === 'cash' && received !== null && amount !== null ? received - amount : null;

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
            {PAYMENT_METHODS.map((value) => (
              <button
                key={value}
                type="button"
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
        <Button size="sm" onClick={() => setValue('amount', order.remainingAmount, { shouldValidate: true })} disabled={pending}>
          {t('pay.fullRemaining')}
        </Button>
      </div>
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
      <Button type="submit" variant="primary" size="lg" fullWidth loading={pending}>
        {t('pay.submit', { amount: format.money(amount) })}
      </Button>
      <p className={styles.disclaimer}>{t('pay.disclaimer')}</p>
    </form>
  );
}
