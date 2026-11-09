import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useSaveOrganization, type OrganizationDto } from '@/entities/organization/organization.queries';
import { LANGUAGES } from '@/shared/constants/locale';
import { useAuth } from '@/shared/hooks/use-auth';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { requiredString, V } from '@/shared/lib/validation';
import { Alert, Button, Card, DemoBadge, FormActions, FormField, FormGrid, Input, Select, useToast } from '@/shared/ui';

const CURRENCIES = ['UZS', 'USD', 'EUR', 'RUB', 'KZT'];

const organizationSchema = z.object({
  name: requiredString(150),
  currency: z.string().regex(/^[A-Z]{3}$/, V.required),
  defaultLanguage: z.enum(LANGUAGES),
});
type OrganizationValues = z.infer<typeof organizationSchema>;

export function OrganizationForm({ organization }: { organization: OrganizationDto }) {
  const { t } = useTranslation('settings');
  const toast = useToast();
  const { reloadUser } = useAuth();
  const save = useSaveOrganization();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, setError, reset, formState } = useForm<OrganizationValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: { name: organization.name, currency: organization.currency, defaultLanguage: organization.defaultLanguage },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const saved = await save.mutateAsync(values);
      reset({ name: saved.name, currency: saved.currency, defaultLanguage: saved.defaultLanguage });
      await reloadUser();
      toast.success(t('organization.saved'));
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['name', 'currency', 'defaultLanguage'])) setServerError(getErrorMessage(error, t));
    }
  });

  const errors = formState.errors;
  return (
    <Card title={t('organization.title')} actions={organization.isDemo ? <DemoBadge title={t('organization.demoHint')} /> : undefined}>
      <FormGrid columns={2} onSubmit={onSubmit}>
        {serverError && <div data-span="full"><Alert>{serverError}</Alert></div>}
        <FormField label={t('organization.name')} error={errors.name?.message} required>
          <Input {...register('name')} />
        </FormField>
        <FormField label={t('organization.slug')} hint={t('organization.slugHint')}>
          <Input value={organization.slug} readOnly disabled />
        </FormField>
        <FormField label={t('organization.currency')} error={errors.currency?.message} hint={t('organization.currencyHint')} required>
          <Select options={CURRENCIES.map((code) => ({ value: code, label: code }))} {...register('currency')} />
        </FormField>
        <FormField label={t('organization.defaultLanguage')} error={errors.defaultLanguage?.message} required>
          <Select options={LANGUAGES.map((lang) => ({ value: lang, label: t(`common:languages.${lang}`) }))} {...register('defaultLanguage')} />
        </FormField>
        <FormActions>
          <Button type="submit" variant="primary" loading={formState.isSubmitting} disabled={!formState.isDirty}>
            {t('common:actions.save')}
          </Button>
        </FormActions>
      </FormGrid>
    </Card>
  );
}
