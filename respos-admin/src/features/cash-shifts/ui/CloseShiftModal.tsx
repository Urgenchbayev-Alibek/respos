import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useCloseShift } from '@/entities/cash-shift/cash-shift.queries';
import type { CashShiftDto } from '@/entities/cash-shift/cash-shift.types';
import { moneyField } from '@/features/payments/model/money-field';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { optionalString } from '@/shared/lib/validation';
import { Alert, Button, FormField, FormGrid, Modal, MoneyInput, Textarea, useToast } from '@/shared/ui';
import { differenceTone, formatSignedMoney } from '../model/shift-format';
import { ShiftAmounts, type AmountRow } from './ShiftAmounts';

const closeSchema = z.object({ actualCashAmount: moneyField(), comment: optionalString(500) });
type CloseValues = z.input<typeof closeSchema>;
type Step = 'form' | 'confirm' | 'done';

/** Close shift: count cash → confirm expected vs actual → server result (its difference wins). */
export function CloseShiftModal({ shift, onClose }: { shift: CashShiftDto; onClose: () => void }) {
  const { t } = useTranslation('cashier');
  const format = useFormatters();
  const toast = useToast();
  const close = useCloseShift();
  const [step, setStep] = useState<Step>('form');
  const [result, setResult] = useState<CashShiftDto | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, register, handleSubmit, setError, getValues, formState } = useForm<CloseValues>({
    resolver: zodResolver(closeSchema),
    defaultValues: { actualCashAmount: null, comment: '' },
  });

  const expected = shift.expectedCashAmount;
  const actual = getValues('actualCashAmount');
  const preview = expected === null || actual === null ? null : Math.round((actual - expected) * 100) / 100;

  const confirm = async () => {
    setServerError(null);
    const values = closeSchema.parse(getValues());
    try {
      const closed = await close.mutateAsync({
        id: shift.id,
        input: { actualCashAmount: values.actualCashAmount ?? 0, comment: values.comment },
      });
      setResult(closed);
      setStep('done');
      toast.success(t('shift.closedToast'));
    } catch (error) {
      setStep('form');
      if (!applyServerFieldErrors(error, setError, ['actualCashAmount', 'comment'])) setServerError(getErrorMessage(error, t));
    }
  };

  const rows = (exp: number | null, act: number | null, diff: number | null, final: boolean): AmountRow[] => [
    { label: t('shift.opening'), value: format.money(shift.openingAmount) },
    { label: t('shift.expected'), value: exp === null ? t('shift.expectedByServer') : format.money(exp), testId: 'shift-expected' },
    { label: t('shift.actual'), value: format.money(act), testId: 'shift-actual' },
    {
      label: final ? t('shift.difference') : t('shift.differencePreview'),
      value: formatSignedMoney(diff, format.money),
      tone: differenceTone(diff),
      testId: 'shift-difference',
    },
  ];

  const footer =
    step === 'done' ? (
      <Button variant="primary" onClick={onClose}>
        {t('shift.done')}
      </Button>
    ) : step === 'confirm' ? (
      <>
        <Button onClick={() => setStep('form')} disabled={close.isPending}>
          {t('shift.back')}
        </Button>
        <Button variant="danger" loading={close.isPending} onClick={() => void confirm()}>
          {t('shift.confirmClose')}
        </Button>
      </>
    ) : (
      <>
        <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
        <Button type="submit" form="close-shift-form" variant="primary">
          {t('shift.next')}
        </Button>
      </>
    );

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t(step === 'done' ? 'shift.closedTitle' : 'shift.closeTitle')}
      description={step === 'confirm' ? t('shift.confirmDescription') : undefined}
      dismissible={!close.isPending}
      footer={footer}
    >
      {step === 'form' && (
        <FormGrid id="close-shift-form" onSubmit={handleSubmit(() => setStep('confirm'))}>
          {serverError && <Alert>{serverError}</Alert>}
          <ShiftAmounts rows={rows(expected, null, null, false).slice(0, 2)} />
          <FormField label={t('shift.actualInput')} error={formState.errors.actualCashAmount?.message} required>
            <Controller
              control={control}
              name="actualCashAmount"
              render={({ field }) => (
                <MoneyInput data-autofocus value={field.value} onChange={field.onChange} onBlur={field.onBlur} currency={format.currency} />
              )}
            />
          </FormField>
          <FormField label={t('shift.comment')} error={formState.errors.comment?.message}>
            <Textarea maxLength={500} {...register('comment')} />
          </FormField>
        </FormGrid>
      )}
      {step === 'confirm' && <ShiftAmounts rows={rows(expected, actual, preview, false)} />}
      {step === 'done' && result && (
        <ShiftAmounts rows={rows(result.expectedCashAmount, result.actualCashAmount, result.difference, true)} />
      )}
    </Modal>
  );
}
