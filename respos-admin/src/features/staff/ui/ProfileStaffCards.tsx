import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useMyPin, useMySchedule, useRemoveMyPin, useSetMyPin } from '@/entities/staff/staff.queries';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { toBranchDateString } from '@/shared/lib/format-date';
import { addDaysToDateString } from '@/shared/lib/zoned-time';
import { Alert, Button, Card, EmptyState, FormActions, FormField, FormGrid, Input, Skeleton, useToast } from '@/shared/ui';
import { formatMinutes, staffErrorMessage } from '../model/staff-errors';
import { myPinSchema, type MyPinValues } from '../model/staff-schemas';

const EMPTY: MyPinValues = { currentPassword: '', pin: '', confirmPin: '' };

/** Profile: set / change / remove the own quick-login PIN (password required). Hidden reason for owner/admin. */
export function MyPinCard() {
  const { t } = useTranslation('staff');
  const toast = useToast();
  const status = useMyPin();
  const setPin = useSetMyPin();
  const removePin = useRemoveMyPin();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<MyPinValues>({ resolver: zodResolver(myPinSchema), defaultValues: EMPTY });

  const onSubmit = handleSubmit(async ({ currentPassword, pin }) => {
    setServerError(null);
    try {
      await setPin.mutateAsync({ currentPassword, pin });
      reset(EMPTY);
      toast.success(t('pin.saved'));
    } catch (error) {
      setServerError(staffErrorMessage(error, t));
    }
  });

  if (status.isLoading) return <Skeleton height={120} />;
  if (!status.data) return null;
  if (!status.data.allowed) {
    return (
      <Card title={t('pin.title')}>
        <p>{t('pin.notAllowed')}</p>
      </Card>
    );
  }

  const errors = formState.errors;
  return (
    <Card title={t('pin.title')}>
      <p>{status.data.hasPin ? t('pin.isSet') : t('pin.notSet')}</p>
      <FormGrid onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('pin.currentPassword')} error={errors.currentPassword?.message} required>
          <Input type="password" autoComplete="current-password" {...register('currentPassword')} />
        </FormField>
        <FormField label={t('pin.new')} hint={t('pin.policy')} error={errors.pin?.message} required>
          <Input type="password" inputMode="numeric" autoComplete="off" maxLength={6} {...register('pin')} />
        </FormField>
        <FormField label={t('pin.confirm')} error={errors.confirmPin?.message} required>
          <Input type="password" inputMode="numeric" autoComplete="off" maxLength={6} {...register('confirmPin')} />
        </FormField>
        <FormActions>
          {status.data.hasPin && (
            <Button variant="ghost" loading={removePin.isPending} onClick={() => void removePin.mutateAsync().then(() => toast.success(t('pin.removed')))}>
              {t('pin.remove')}
            </Button>
          )}
          <Button type="submit" variant="primary" loading={formState.isSubmitting}>
            {status.data.hasPin ? t('pin.change') : t('pin.set')}
          </Button>
        </FormActions>
      </FormGrid>
    </Card>
  );
}

/** Profile: own planned shifts for the next 14 days in the current branch. */
export function MyScheduleCard() {
  const { t } = useTranslation('staff');
  const format = useFormatters();
  const { branch } = useCurrentBranch();
  const from = toBranchDateString(new Date(), branch?.timezone);
  const range = { from, to: addDaysToDateString(from, 13) };
  const shifts = useMySchedule(range, Boolean(branch));
  if (!branch) return null;

  return (
    <Card title={t('schedule.myTitle')}>
      {shifts.isLoading && <Skeleton height={80} />}
      {shifts.data?.length === 0 && <EmptyState compact title={t('schedule.myEmpty')} />}
      {shifts.data && shifts.data.length > 0 && (
        <ul>
          {shifts.data.map((shift) => (
            <li key={shift.id}>
              {format.date(`${shift.date}T12:00:00Z`)} · {shift.startTime}–{shift.endTime} ({formatMinutes(shift.plannedMinutes)})
              {shift.roleNote ? ` · ${shift.roleNote}` : ''}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
