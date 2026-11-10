import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, MessageSquareText, Send } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSaveIntegration } from '@/entities/integration/integration.queries';
import type { IntegrationDto, IntegrationType } from '@/entities/integration/integration.types';
import { isApiError } from '@/shared/api/api-error';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, Card, DemoBadge, FormActions, FormField, FormGrid, Input, StatusBadge, Switch, useToast } from '@/shared/ui';
import { INTEGRATION_FIELDS, integrationSchema, toConfig, toFormValues, type IntegrationFormValues } from '../model/integration-fields';
import { IntegrationTestPanel } from './IntegrationTestPanel';
import styles from './integrations.module.css';

const ICONS: Record<IntegrationType, typeof Send> = { telegram: Send, sms_eskiz: MessageSquareText, smtp: Mail };

export function IntegrationStatusBadge({ integration }: { integration: IntegrationDto }) {
  const { t } = useTranslation('integrations');
  if (integration.status === 'not_configured') return <DemoBadge kind="not-connected" title={t('status.notConfiguredHint')} />;
  return (
    <StatusBadge tone={integration.status === 'connected' ? 'success' : 'danger'}>{t(`status.${integration.status}`)}</StatusBadge>
  );
}

/** One integration: status, settings form (secrets masked), "send test". */
export function IntegrationCard({ integration }: { integration: IntegrationDto }) {
  const { t } = useTranslation('integrations');
  const toast = useToast();
  const format = useFormatters();
  const save = useSaveIntegration();
  const [serverError, setServerError] = useState<string | null>(null);
  const type = integration.type;
  const Icon = ICONS[type];
  const { register, control, handleSubmit, setError, reset, formState } = useForm<IntegrationFormValues>({
    resolver: zodResolver(integrationSchema(type)),
    defaultValues: toFormValues(integration),
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const saved = await save.mutateAsync({ type, isEnabled: values.isEnabled, config: toConfig(type, values) });
      reset(toFormValues(saved));
      toast.success(t('saved'));
    } catch (error) {
      let matched = false;
      if (isApiError(error)) {
        for (const [key, messages] of Object.entries(error.fieldErrors)) {
          const name = key.replace(/^config\./, '');
          if (INTEGRATION_FIELDS[type].some((field) => field.name === name) && messages[0]) {
            setError(name, { type: 'server', message: messages[0] });
            matched = true;
          }
        }
      }
      if (!matched) setServerError(getErrorMessage(error, t));
    }
  });

  const errors = formState.errors as Record<string, { message?: string } | undefined>;
  return (
    <Card
      title={<span className={styles.title}><Icon aria-hidden="true" />{t(`types.${type}.title`)}</span>}
      actions={<IntegrationStatusBadge integration={integration} />}
      data-testid={`integration-${type}`}
    >
      <p className={styles.muted}>{t(`types.${type}.description`)}</p>
      {integration.status === 'error' && integration.lastError && (
        <Alert>{t('lastError', { error: integration.lastError, at: integration.lastErrorAt ? format.dateTime(integration.lastErrorAt) : '—' })}</Alert>
      )}
      {integration.lastSuccessAt && (
        <p className={styles.muted}>{t('lastSuccess', { at: format.dateTime(integration.lastSuccessAt) })}</p>
      )}
      <FormGrid columns={2} onSubmit={onSubmit} aria-label={t(`types.${type}.title`)}>
        {serverError && <div data-span="full"><Alert>{serverError}</Alert></div>}
        <div data-span="full">
          <Controller
            control={control}
            name="isEnabled"
            render={({ field }) => <Switch checked={Boolean(field.value)} onChange={field.onChange} label={t('enabled')} />}
          />
        </div>
        {INTEGRATION_FIELDS[type].map((field) => {
          const label = t(`fields.${type}.${field.name}`);
          const hint = field.hint ? t(`hints.${type}.${field.name}`) : undefined;
          if (field.kind === 'switch') {
            return (
              <div key={field.name} data-span="full">
                <Controller
                  control={control}
                  name={field.name}
                  render={({ field: f }) => <Switch checked={Boolean(f.value)} onChange={f.onChange} label={label} />}
                />
                {hint && <small className={styles.muted}>{hint}</small>}
              </div>
            );
          }
          return (
            <FormField key={field.name} label={label} hint={hint} error={errors[field.name]?.message} required={field.required}>
              <Input
                {...register(field.name)}
                type={field.kind === 'secret' ? 'password' : field.kind === 'number' ? 'number' : field.kind === 'email' ? 'email' : 'text'}
                inputMode={field.kind === 'number' ? 'decimal' : undefined}
                autoComplete={field.kind === 'secret' ? 'new-password' : 'off'}
                placeholder={field.kind === 'secret' ? t('secretPlaceholder') : field.kind === 'time' ? '21:00' : undefined}
              />
            </FormField>
          );
        })}
        <FormActions>
          <Button type="submit" variant="primary" loading={formState.isSubmitting} disabled={!formState.isDirty}>
            {t('common:actions.save')}
          </Button>
        </FormActions>
      </FormGrid>
      <IntegrationTestPanel integration={integration} />
    </Card>
  );
}
