import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useFeatures, useSavePlan } from '@/entities/platform/platform.queries';
import type { PlanDto } from '@/entities/platform/platform.types';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, Checkbox, FormField, FormGrid, Input, Modal, Switch, useToast } from '@/shared/ui';
import { planSchema, type PlanOutput } from '../model/platform-schemas';
import styles from './platform.module.css';

interface Values {
  code: string;
  name: string;
  maxBranches: string;
  maxUsers: string;
  isActive: boolean;
  features: string[];
}

function toValues(plan: PlanDto | null): Values {
  return {
    code: plan?.code ?? '',
    name: plan?.name ?? '',
    maxBranches: plan ? String(plan.maxBranches) : '1',
    maxUsers: plan ? String(plan.maxUsers) : '10',
    isActive: plan?.isActive ?? true,
    features: plan?.features ?? [],
  };
}

/** Plan limits (branches/users) and included features. */
export function PlanFormModal({ target, onClose }: { target: { plan: PlanDto | null } | null; onClose: () => void }) {
  const { t } = useTranslation('platform');
  const toast = useToast();
  const features = useFeatures(target !== null);
  const save = useSavePlan();
  const [serverError, setServerError] = useState<string | null>(null);
  const plan = target?.plan ?? null;
  const { register, control, handleSubmit, reset, setError, formState } = useForm<Values, unknown, PlanOutput>({
    resolver: zodResolver(planSchema) as unknown as Resolver<Values>,
    defaultValues: toValues(null),
  });

  useEffect(() => {
    reset(toValues(target?.plan ?? null));
    setServerError(null);
  }, [target, reset]);

  const onSubmit = handleSubmit(async (input) => {
    try {
      await save.mutateAsync({ id: plan?.id, input });
      toast.success(t('plans.saved'));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['code', 'name', 'maxBranches', 'maxUsers'])) setServerError(getErrorMessage(error, t));
    }
  });

  const errors = formState.errors;
  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={t(plan ? 'plans.editTitle' : 'plans.createTitle')}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" type="submit" form="plan-form" loading={formState.isSubmitting}>{t('common:actions.save')}</Button>
        </>
      }
    >
      <FormGrid id="plan-form" columns={2} onSubmit={onSubmit}>
        {serverError && <div data-span="full"><Alert>{serverError}</Alert></div>}
        <FormField label={t('fields.planCode')} error={errors.code?.message} required>
          <Input autoComplete="off" disabled={Boolean(plan)} data-autofocus {...register('code')} />
        </FormField>
        <FormField label={t('fields.planName')} error={errors.name?.message} required>
          <Input autoComplete="off" {...register('name')} />
        </FormField>
        <FormField label={t('fields.maxBranches')} error={errors.maxBranches?.message} required>
          <Input type="number" min={1} {...register('maxBranches')} />
        </FormField>
        <FormField label={t('fields.maxUsers')} error={errors.maxUsers?.message} required>
          <Input type="number" min={1} {...register('maxUsers')} />
        </FormField>
        <div data-span="full">
          <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label={t('fields.planActive')} />} />
        </div>
        <div data-span="full">
          <Controller
            control={control}
            name="features"
            render={({ field }) => (
              <fieldset className={styles.features}>
                <legend>{t('fields.features')}</legend>
                {(features.data ?? []).map((feature) => (
                  <Checkbox
                    key={feature.code}
                    label={feature.name}
                    description={feature.code}
                    checked={field.value.includes(feature.code)}
                    onChange={(event) =>
                      field.onChange(event.target.checked ? [...field.value, feature.code] : field.value.filter((code) => code !== feature.code))
                    }
                  />
                ))}
              </fieldset>
            )}
          />
        </div>
      </FormGrid>
    </Modal>
  );
}
