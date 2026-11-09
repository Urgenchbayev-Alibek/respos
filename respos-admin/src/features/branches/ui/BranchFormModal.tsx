import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useSaveBranch } from '@/entities/branch/branch.queries';
import type { BranchDto } from '@/entities/branch/branch.types';
import { DEFAULT_TIMEZONE } from '@/shared/constants/locale';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { optionalString, phoneSchema, requiredString } from '@/shared/lib/validation';
import { Alert, Button, FormField, FormGrid, Input, Modal, Select, useToast } from '@/shared/ui';

const branchSchema = z.object({
  name: requiredString(150),
  address: optionalString(300),
  phone: phoneSchema,
  timezone: requiredString(64),
});
type BranchValues = z.input<typeof branchSchema>;

const FALLBACK_TIMEZONES = ['Asia/Tashkent', 'Asia/Samarkand', 'Asia/Almaty', 'Europe/Moscow', 'UTC'];

function timezones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: 'timeZone') => string[] };
  const all = intl.supportedValuesOf?.('timeZone') ?? FALLBACK_TIMEZONES;
  return all.includes(DEFAULT_TIMEZONE) ? all : [DEFAULT_TIMEZONE, ...all];
}

export function BranchFormModal({ branch, onClose }: { branch: BranchDto | null; onClose: () => void }) {
  const { t } = useTranslation('branches');
  const toast = useToast();
  const save = useSaveBranch();
  const [serverError, setServerError] = useState<string | null>(null);
  const zones = useMemo(() => timezones().map((zone) => ({ value: zone, label: zone })), []);
  const { register, handleSubmit, reset, setError, formState } = useForm<BranchValues>({
    resolver: zodResolver(branchSchema),
  });

  useEffect(() => {
    reset({
      name: branch?.name ?? '',
      address: branch?.address ?? '',
      phone: branch?.phone ?? '',
      timezone: branch?.timezone ?? DEFAULT_TIMEZONE,
    });
  }, [branch, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const parsed = branchSchema.parse(values);
    try {
      await save.mutateAsync({ id: branch?.id, input: parsed });
      toast.success(t(branch ? 'toast.updated' : 'toast.created'));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['name', 'address', 'phone', 'timezone'])) {
        setServerError(getErrorMessage(error, t));
      }
    }
  });

  const errors = formState.errors;
  return (
    <Modal
      open
      onClose={onClose}
      title={t(branch ? 'form.editTitle' : 'form.createTitle')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button type="submit" form="branch-form" variant="primary" loading={formState.isSubmitting}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <FormGrid id="branch-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('fields.name')} error={errors.name?.message} required>
          <Input data-autofocus {...register('name')} />
        </FormField>
        <FormField label={t('fields.address')} error={errors.address?.message}>
          <Input {...register('address')} />
        </FormField>
        <FormField label={t('fields.phone')} error={errors.phone?.message}>
          <Input type="tel" {...register('phone')} />
        </FormField>
        <FormField label={t('fields.timezone')} error={errors.timezone?.message} required>
          <Select options={zones} {...register('timezone')} />
        </FormField>
      </FormGrid>
    </Modal>
  );
}
