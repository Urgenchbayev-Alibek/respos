import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useApplyDiscount } from '@/entities/order/order.queries';
import { DISCOUNT_TYPES, formatOrderNumber, type OrderDto } from '@/entities/order/order.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Modal, MoneyInput, Select, Textarea, useToast } from '@/shared/ui';
import { discountSchema, toDiscountInput, type DiscountFormValues } from '../model/discount-schema';

/** Apply / change / remove the order discount (orders.discount.apply). Totals come back from the server. */
export function DiscountModal({ order, onClose }: { order: OrderDto; onClose: () => void }) {
  const { t } = useTranslation('orderActions');
  const format = useFormatters();
  const toast = useToast();
  const apply = useApplyDiscount();
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, register, handleSubmit, setError, watch, formState } = useForm<DiscountFormValues>({
    resolver: zodResolver(discountSchema),
    defaultValues: {
      type: order.discountType === 'none' ? 'percent' : order.discountType,
      value: order.discountType === 'none' ? null : order.discountValue,
      reason: '',
    },
  });
  const type = watch('type');

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await apply.mutateAsync({ orderId: order.id, input: toDiscountInput(values) });
      toast.success(values.type === 'none' ? t('discount.removed') : t('discount.applied'));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['value', 'reason'])) setServerError(getErrorMessage(error, t));
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t('discount.title', { number: formatOrderNumber(order.number) })}
      description={t('discount.description', { subtotal: format.money(order.subtotal) })}
      dismissible={!apply.isPending}
      footer={
        <>
          <Button onClick={onClose} disabled={apply.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form="discount-form" variant="primary" loading={apply.isPending}>
            {t('discount.submit')}
          </Button>
        </>
      }
    >
      <FormGrid id="discount-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('discount.type')} required>
          <Select
            {...register('type')}
            options={DISCOUNT_TYPES.map((value) => ({ value, label: t(`discount.types.${value}`) }))}
          />
        </FormField>
        {type !== 'none' && (
          <FormField
            label={type === 'percent' ? t('discount.percent') : t('discount.amount')}
            error={formState.errors.value?.message}
            required
          >
            <Controller
              control={control}
              name="value"
              render={({ field }) => (
                <MoneyInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  currency={type === 'percent' ? '%' : format.currency}
                />
              )}
            />
          </FormField>
        )}
        <FormField label={t('common:fields.reason')} error={formState.errors.reason?.message} required={type !== 'none'}>
          <Textarea data-autofocus maxLength={500} {...register('reason')} />
        </FormField>
      </FormGrid>
    </Modal>
  );
}
