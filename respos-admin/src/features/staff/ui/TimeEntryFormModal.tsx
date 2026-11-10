import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSaveTimeEntry } from '@/entities/staff/staff.queries';
import type { StaffMemberDto, TimeEntryDto } from '@/entities/staff/staff.types';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { utcToZonedParts, zonedToUtcIso } from '@/shared/lib/zoned-time';
import { Alert, Button, FormField, FormGrid, Input, Modal, Select, Textarea, useToast } from '@/shared/ui';
import { staffErrorMessage } from '../model/staff-errors';
import { timeEntrySchema, type TimeEntryOutput, type TimeEntryValues } from '../model/staff-schemas';

export interface TimeEntryFormModalProps {
  /** Existing entry → correction; null → manual entry. */
  entry: TimeEntryDto | null;
  members: StaffMemberDto[];
  onClose: () => void;
}

/** Manager: manual entry or correction (times in branch timezone, reason required — audited server-side). */
export function TimeEntryFormModal({ entry, members, onClose }: TimeEntryFormModalProps) {
  const { t } = useTranslation('staff');
  const toast = useToast();
  const { branch } = useCurrentBranch();
  const zone = branch?.timezone;
  const save = useSaveTimeEntry();
  const [serverError, setServerError] = useState<string | null>(null);
  const clockIn = entry ? utcToZonedParts(entry.clockInAt, zone) : null;
  const clockOut = entry?.clockOutAt ? utcToZonedParts(entry.clockOutAt, zone) : null;
  const { register, handleSubmit, formState } = useForm<TimeEntryValues, unknown, TimeEntryOutput>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: {
      userId: entry?.userId ?? '',
      inDate: clockIn?.date ?? '',
      inTime: clockIn?.time ?? '',
      outDate: clockOut?.date ?? clockIn?.date ?? '',
      outTime: clockOut?.time ?? '',
      breakMinutes: entry?.breakMinutes ?? 0,
      note: entry?.note ?? '',
      reason: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const out = values.outDate && values.outTime ? zonedToUtcIso(values.outDate, values.outTime, zone) : '';
    try {
      await save.mutateAsync({
        id: entry?.id,
        userId: values.userId,
        clockInAt: zonedToUtcIso(values.inDate, values.inTime, zone),
        clockOutAt: out || null,
        breakMinutes: values.breakMinutes,
        note: values.note ?? null,
        reason: values.reason,
      });
      toast.success(t('entries.saved'));
      onClose();
    } catch (error) {
      setServerError(staffErrorMessage(error, t));
    }
  });

  const errors = formState.errors;
  return (
    <Modal
      open
      onClose={onClose}
      title={entry ? t('entries.editTitle') : t('entries.createTitle')}
      description={t('entries.auditHint')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose} disabled={formState.isSubmitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form="time-entry-form" variant="primary" loading={formState.isSubmitting}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <FormGrid id="time-entry-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('fields.employee')} error={errors.userId?.message} required>
          <Select
            disabled={Boolean(entry)}
            placeholder={t('fields.chooseEmployee')}
            options={members.map((member) => ({ value: member.userId, label: member.fullName }))}
            {...register('userId')}
          />
        </FormField>
        <FormField label={t('fields.clockInDate')} error={errors.inDate?.message} required>
          <Input type="date" {...register('inDate')} />
        </FormField>
        <FormField label={t('fields.clockInTime')} error={errors.inTime?.message} required>
          <Input type="time" {...register('inTime')} />
        </FormField>
        <FormField label={t('fields.clockOutDate')} hint={t('fields.clockOutHint')}>
          <Input type="date" {...register('outDate')} />
        </FormField>
        <FormField label={t('fields.clockOutTime')}>
          <Input type="time" {...register('outTime')} />
        </FormField>
        <FormField label={t('fields.breakMinutes')} error={errors.breakMinutes?.message}>
          <Input type="number" inputMode="numeric" min={0} {...register('breakMinutes')} />
        </FormField>
        <FormField label={t('fields.note')} error={errors.note?.message}>
          <Input {...register('note')} />
        </FormField>
        <FormField label={t('fields.reason')} error={errors.reason?.message} required>
          <Textarea rows={2} {...register('reason')} />
        </FormField>
      </FormGrid>
    </Modal>
  );
}
