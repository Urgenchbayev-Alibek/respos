import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useSaveCustomer } from '@/entities/customer/customer.queries';
import type { CustomerDto, CustomerGender } from '@/entities/customer/customer.types';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { optionalString, requiredString, V } from '@/shared/lib/validation';
import { Alert, Button, Checkbox, FormField, FormGrid, Input, Modal, Select, Textarea, useToast } from '@/shared/ui';

const schema = z.object({
  phone: z.string().trim().regex(/^\+?[\d\s\-()]{9,20}$/, V.phone),
  name: requiredString(200),
  birthday: z.string().optional(),
  gender: z.enum(['', 'male', 'female']),
  tags: optionalString(700),
  notes: optionalString(2000),
  marketingConsent: z.boolean(),
});
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;
const FIELDS = ['phone', 'name', 'birthday', 'gender', 'tags', 'notes'] as const;

export interface CustomerFormTarget {
  customer: CustomerDto | null;
  /** Prefill for quick create (e.g. the phone typed in the attach dialog). */
  phone?: string;
}

function toValues(target: CustomerFormTarget | null): Values {
  const c = target?.customer;
  return {
    phone: c?.phone ?? target?.phone ?? '',
    name: c?.name ?? '',
    birthday: c?.birthday ?? '',
    gender: c?.gender ?? '',
    tags: c?.tags.join(', ') ?? '',
    notes: c?.notes ?? '',
    marketingConsent: c?.marketingConsent ?? false,
  };
}

interface CustomerFormModalProps {
  target: CustomerFormTarget | null;
  onClose: () => void;
  onSaved?: (customer: CustomerDto) => void;
}

/** Create / edit a guest. Phone is normalized to +998… by the server (unique per organization). */
export function CustomerFormModal({ target, onClose, onSaved }: CustomerFormModalProps) {
  const { t } = useTranslation('customers');
  const toast = useToast();
  const save = useSaveCustomer();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: toValues(null),
  });
  const customer = target?.customer ?? null;

  useEffect(() => {
    reset(toValues(target));
    setServerError(null);
  }, [target, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        id: customer?.id,
        input: {
          phone: values.phone,
          name: values.name,
          birthday: values.birthday || null,
          gender: (values.gender || null) as CustomerGender | null,
          notes: values.notes ?? null,
          tags: (values.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean),
          marketingConsent: values.marketingConsent,
        },
      });
      toast.success(t(customer ? 'toast.updated' : 'toast.created'));
      onSaved?.(saved);
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
      title={t(customer ? 'form.editTitle' : 'form.createTitle')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose} disabled={formState.isSubmitting}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" type="submit" form="customer-form" loading={formState.isSubmitting}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <FormGrid id="customer-form" columns={2} onSubmit={onSubmit}>
        {serverError && <div data-span="full"><Alert>{serverError}</Alert></div>}
        <FormField label={t('fields.phone')} error={errors.phone?.message} hint={t('form.phoneHint')} required>
          <Input type="tel" autoComplete="off" data-autofocus {...register('phone')} />
        </FormField>
        <FormField label={t('fields.name')} error={errors.name?.message} required>
          <Input autoComplete="off" {...register('name')} />
        </FormField>
        <FormField label={t('fields.birthday')} error={errors.birthday?.message}>
          <Input type="date" {...register('birthday')} />
        </FormField>
        <FormField label={t('fields.gender')} error={errors.gender?.message}>
          <Select
            placeholder={t('form.genderUnknown')}
            options={[
              { value: 'male', label: t('gender.male') },
              { value: 'female', label: t('gender.female') },
            ]}
            {...register('gender')}
          />
        </FormField>
        <div data-span="full">
          <FormField label={t('fields.tags')} error={errors.tags?.message} hint={t('form.tagsHint')}>
            <Input autoComplete="off" {...register('tags')} />
          </FormField>
        </div>
        <div data-span="full">
          <FormField label={t('fields.notes')} error={errors.notes?.message}>
            <Textarea {...register('notes')} />
          </FormField>
        </div>
        <div data-span="full">
          <Checkbox label={t('fields.marketingConsent')} {...register('marketingConsent')} />
        </div>
      </FormGrid>
    </Modal>
  );
}
