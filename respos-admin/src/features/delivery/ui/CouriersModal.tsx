import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useCouriers, useSaveCourier } from '@/entities/delivery/delivery.queries';
import { telLink, type CourierDto } from '@/entities/delivery/delivery.types';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { requiredString } from '@/shared/lib/validation';
import { Alert, Button, EmptyState, ErrorState, FormField, IconButton, Input, Modal, Spinner, StatusBadge, Switch } from '@/shared/ui';
import { deliveryPhoneSchema, normalizePhone } from '../model/delivery-form';
import styles from './Delivery.module.css';

const courierSchema = z.object({ name: requiredString(200), phone: deliveryPhoneSchema, isActive: z.boolean() });
type CourierValues = z.input<typeof courierSchema>;
const EMPTY: CourierValues = { name: '', phone: '', isActive: true };

/** Couriers of the current branch: list (incl. inactive) + add / edit form. */
export function CouriersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('delivery');
  const couriers = useCouriers(true);
  const save = useSaveCourier();
  const [editing, setEditing] = useState<CourierDto | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset, setError, formState } = useForm<CourierValues>({
    resolver: zodResolver(courierSchema),
    defaultValues: EMPTY,
  });

  const startEdit = (courier: CourierDto | null) => {
    setEditing(courier);
    setServerError(null);
    reset(courier ? { name: courier.name, phone: courier.phone, isActive: courier.isActive } : EMPTY);
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const parsed = courierSchema.parse(values);
    try {
      await save.mutateAsync({ id: editing?.id, input: { ...parsed, phone: normalizePhone(parsed.phone) ?? parsed.phone } });
      startEdit(null);
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['name', 'phone', 'isActive'])) setServerError(getErrorMessage(error, t));
    }
  });

  return (
    <Modal open={open} onClose={onClose} title={t('couriers.title')} size="md">
      {couriers.isLoading && <Spinner />}
      {couriers.error && <ErrorState error={couriers.error} onRetry={() => void couriers.refetch()} />}
      {couriers.data?.length === 0 && <EmptyState compact title={t('couriers.empty')} />}
      <ul className={styles.courierList}>
        {couriers.data?.map((courier) => (
          <li key={courier.id}>
            <span>{courier.name}</span>
            <a href={telLink(courier.phone)}>{courier.phone}</a>
            {!courier.isActive && <StatusBadge size="sm" tone="neutral">{t('couriers.inactive')}</StatusBadge>}
            <IconButton label={t('couriers.edit', { name: courier.name })} icon={<Pencil />} size="sm" onClick={() => startEdit(courier)} />
          </li>
        ))}
      </ul>
      <form className={styles.courierForm} onSubmit={onSubmit} noValidate>
        <h3 className={styles.cartTitle}>{editing ? t('couriers.editTitle') : t('couriers.add')}</h3>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('couriers.name')} error={formState.errors.name?.message} required>
          <Input {...register('name')} />
        </FormField>
        <FormField label={t('couriers.phone')} error={formState.errors.phone?.message} required>
          <Input type="tel" inputMode="tel" {...register('phone')} />
        </FormField>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label={t('couriers.active')} />}
        />
        <div className={styles.actions}>
          {editing && (
            <Button variant="ghost" onClick={() => startEdit(null)}>
              {t('common:actions.cancel')}
            </Button>
          )}
          <Button type="submit" variant="primary" loading={formState.isSubmitting}>
            {t('common:actions.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
