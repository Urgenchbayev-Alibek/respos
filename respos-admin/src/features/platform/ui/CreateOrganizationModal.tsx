import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useCreateOrganization, usePlans } from '@/entities/platform/platform.queries';
import { DEFAULT_CURRENCY } from '@/shared/constants/locale';
import { applyServerCodeError, applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Input, Modal, Select, useToast } from '@/shared/ui';
import { createOrganizationSchema, slugify, type CreateOrganizationValues } from '../model/platform-schemas';

const FIELDS = ['name', 'slug', 'currency', 'branchName', 'planCode', 'ownerFullName', 'ownerEmail', 'ownerPassword'] as const;
/** Domain errors without field `errors` → the field they are about. */
const CODE_FIELDS = { 'organization.slug_taken': 'slug', 'user.email_taken': 'ownerEmail', 'plan.not_found': 'planCode' } as const;
const EMPTY: CreateOrganizationValues = {
  name: '',
  slug: '',
  currency: DEFAULT_CURRENCY,
  branchName: '',
  planCode: '',
  ownerFullName: '',
  ownerEmail: '',
  ownerPassword: '',
};

/** Creates org + first branch + system roles + owner (server-side, one transaction). */
export function CreateOrganizationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('platform');
  const toast = useToast();
  const plans = usePlans(open);
  const create = useCreateOrganization();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, setValue, getFieldState, formState } = useForm<CreateOrganizationValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) {
      reset(EMPTY);
      setServerError(null);
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await create.mutateAsync(values);
      toast.success(t('organizations.created', { name: values.name }));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, FIELDS) && !applyServerCodeError(error, setError, CODE_FIELDS, t)) {
        setServerError(getErrorMessage(error, t));
      }
    }
  });

  const nameField = register('name');
  const errors = formState.errors;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('organizations.createTitle')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose} disabled={formState.isSubmitting}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" type="submit" form="create-org-form" loading={formState.isSubmitting}>{t('organizations.create')}</Button>
        </>
      }
    >
      <FormGrid id="create-org-form" columns={2} onSubmit={onSubmit}>
        {serverError && <div data-span="full"><Alert>{serverError}</Alert></div>}
        <FormField label={t('fields.orgName')} error={errors.name?.message} required>
          <Input
            autoComplete="off"
            data-autofocus
            {...nameField}
            onChange={(event) => {
              void nameField.onChange(event);
              if (!getFieldState('slug').isDirty) setValue('slug', slugify(event.target.value));
            }}
          />
        </FormField>
        <FormField label={t('fields.slug')} error={errors.slug?.message} hint={t('fields.slugHint')} required>
          <Input autoComplete="off" {...register('slug')} />
        </FormField>
        <FormField label={t('fields.currency')} error={errors.currency?.message} required>
          <Input autoComplete="off" maxLength={3} {...register('currency')} />
        </FormField>
        <FormField label={t('fields.plan')} error={errors.planCode?.message} required>
          <Select
            placeholder={t('fields.selectPlan')}
            options={(plans.data ?? []).filter((plan) => plan.isActive).map((plan) => ({ value: plan.code, label: plan.name }))}
            {...register('planCode')}
          />
        </FormField>
        <FormField label={t('fields.branchName')} error={errors.branchName?.message} required>
          <Input autoComplete="off" {...register('branchName')} />
        </FormField>
        <FormField label={t('fields.ownerFullName')} error={errors.ownerFullName?.message} required>
          <Input autoComplete="off" {...register('ownerFullName')} />
        </FormField>
        <FormField label={t('fields.ownerEmail')} error={errors.ownerEmail?.message} required>
          <Input type="email" autoComplete="off" {...register('ownerEmail')} />
        </FormField>
        <FormField label={t('fields.ownerPassword')} error={errors.ownerPassword?.message} hint={t('auth:passwordPolicy')} required>
          <Input type="password" autoComplete="new-password" {...register('ownerPassword')} />
        </FormField>
      </FormGrid>
    </Modal>
  );
}
