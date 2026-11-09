import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useSaveSupplier } from '@/entities/supplier/supplier.queries';
import type { SupplierDto } from '@/entities/supplier/supplier.types';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { optionalString, phoneSchema, requiredString, V } from '@/shared/lib/validation';
import { Alert, Button, FormField, FormGrid, Input, Modal, Textarea, useToast } from '@/shared/ui';

const schema = z.object({
  name: requiredString(200),
  contactPerson: optionalString(150),
  phone: phoneSchema,
  email: z.string().trim().email(V.email).max(254, V.maxLength).optional().or(z.literal('')).transform((v) => v || undefined),
  address: optionalString(300),
  inn: optionalString(20),
  notes: optionalString(1000),
});
type Output = z.output<typeof schema>;
type Values = Record<keyof Output, string>;
const FIELDS = ['name', 'contactPerson', 'phone', 'email', 'address', 'inn', 'notes'] as const;

function toValues(supplier?: SupplierDto | null): Values {
  return {
    name: supplier?.name ?? '',
    contactPerson: supplier?.contactPerson ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    address: supplier?.address ?? '',
    inn: supplier?.inn ?? '',
    notes: supplier?.notes ?? '',
  };
}

export function SupplierFormModal({ target, onClose }: { target: { supplier: SupplierDto | null } | null; onClose: () => void }) {
  const { t } = useTranslation('suppliers');
  const toast = useToast();
  const save = useSaveSupplier();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: toValues(),
  });
  const supplier = target?.supplier ?? null;

  useEffect(() => {
    reset(toValues(target?.supplier));
    setServerError(null);
  }, [target, reset]);

  const onSubmit = handleSubmit(async (input) => {
    try {
      await save.mutateAsync({ id: supplier?.id, input });
      toast.success(t(supplier ? 'toast.updated' : 'toast.created'));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, FIELDS)) setServerError(getErrorMessage(error, t));
    }
  });

  const errors = formState.errors;
  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      size="lg"
      title={t(supplier ? 'form.editTitle' : 'form.createTitle')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose} disabled={formState.isSubmitting}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" type="submit" form="supplier-form" loading={formState.isSubmitting}>{t('common:actions.save')}</Button>
        </>
      }
    >
      <FormGrid id="supplier-form" columns={2} onSubmit={onSubmit}>
        {serverError && <div data-span="full"><Alert>{serverError}</Alert></div>}
        <FormField label={t('fields.name')} error={errors.name?.message} required>
          <Input autoComplete="off" data-autofocus {...register('name')} />
        </FormField>
        <FormField label={t('fields.contactPerson')} error={errors.contactPerson?.message}>
          <Input autoComplete="off" {...register('contactPerson')} />
        </FormField>
        <FormField label={t('fields.phone')} error={errors.phone?.message}>
          <Input type="tel" autoComplete="off" {...register('phone')} />
        </FormField>
        <FormField label={t('fields.email')} error={errors.email?.message}>
          <Input type="email" autoComplete="off" {...register('email')} />
        </FormField>
        <FormField label={t('fields.address')} error={errors.address?.message}>
          <Input autoComplete="off" {...register('address')} />
        </FormField>
        <FormField label={t('fields.inn')} error={errors.inn?.message}>
          <Input autoComplete="off" inputMode="numeric" {...register('inn')} />
        </FormField>
        <div data-span="full">
          <FormField label={t('fields.notes')} error={errors.notes?.message}>
            <Textarea {...register('notes')} />
          </FormField>
        </div>
      </FormGrid>
    </Modal>
  );
}
