import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useCreateRefund } from '@/entities/payment/payment.queries';
import type { CreateRefundInput, PaymentDto } from '@/entities/payment/payment.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { requiredString } from '@/shared/lib/validation';
import { Alert, Button, FormField, FormGrid, Modal, MoneyInput, Textarea, useToast } from '@/shared/ui';
import { useIdempotentSubmit } from '../model/use-idempotent-submit';
import { moneyField } from '../model/money-field';
import { getRefundable } from '../model/payment-labels';

function refundSchema(refundable: number) {
  return z.object({
    amount: moneyField({ positive: true, max: refundable, maxMessage: 'payments:refund.exceedsRefundable' }),
    reason: requiredString(500),
  });
}

type RefundValues = z.input<ReturnType<typeof refundSchema>>;

/** Refund (payments.refund): reason required, amount ≤ refundable; the server re-checks both. */
export function RefundModal({ payment, onClose }: { payment: PaymentDto; onClose: () => void }) {
  const { t } = useTranslation('payments');
  const format = useFormatters();
  const toast = useToast();
  const { mutateAsync } = useCreateRefund();
  const refundable = getRefundable(payment);
  const schema = useMemo(() => refundSchema(refundable), [refundable]);
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, register, handleSubmit, setError, formState } = useForm<RefundValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: refundable, reason: '' },
  });

  const run = useCallback(
    (input: CreateRefundInput, idempotencyKey: string) =>
      mutateAsync({ paymentId: payment.id, input, idempotencyKey }),
    [mutateAsync, payment.id],
  );
  const { submit, pending } = useIdempotentSubmit(run);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const done = await submit({ amount: values.amount ?? 0, reason: values.reason.trim() });
      if (done === undefined) return;
      toast.success(t('refund.success', { amount: format.money(values.amount) }));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['amount', 'reason'])) setServerError(getErrorMessage(error, t));
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t('refund.title')}
      description={t('refund.description', { amount: format.money(payment.amount), refundable: format.money(refundable) })}
      dismissible={!pending}
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form="refund-form" variant="danger" loading={pending}>
            {t('refund.submit')}
          </Button>
        </>
      }
    >
      <FormGrid id="refund-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('refund.amount')} error={formState.errors.amount?.message} required>
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} currency={format.currency} />
            )}
          />
        </FormField>
        <FormField label={t('common:fields.reason')} error={formState.errors.reason?.message} required>
          <Textarea data-autofocus maxLength={500} {...register('reason')} />
        </FormField>
      </FormGrid>
    </Modal>
  );
}
