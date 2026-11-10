import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useDeleteShift, useSaveShift } from '@/entities/staff/staff.queries';
import type { ShiftDto, StaffMemberDto } from '@/entities/staff/staff.types';
import { Alert, Button, FormField, FormGrid, Input, Modal, Select, useToast } from '@/shared/ui';
import { staffErrorMessage } from '../model/staff-errors';
import { shiftSchema, type ShiftOutput, type ShiftValues } from '../model/staff-schemas';

export interface ShiftFormModalProps {
  shift: ShiftDto | null;
  /** Prefill for a new shift (grid cell click). */
  initial?: { userId: string; date: string };
  members: StaffMemberDto[];
  onClose: () => void;
}

/** Create / edit / delete a planned shift (branch local time; end ≤ start = overnight). */
export function ShiftFormModal({ shift, initial, members, onClose }: ShiftFormModalProps) {
  const { t } = useTranslation('staff');
  const toast = useToast();
  const save = useSaveShift();
  const remove = useDeleteShift();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<ShiftValues, unknown, ShiftOutput>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      userId: shift?.userId ?? initial?.userId ?? '',
      date: shift?.date ?? initial?.date ?? '',
      startTime: shift?.startTime ?? '09:00',
      endTime: shift?.endTime ?? '18:00',
      roleNote: shift?.roleNote ?? '',
      note: shift?.note ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await save.mutateAsync({ ...values, id: shift?.id, roleNote: values.roleNote ?? null, note: values.note ?? null });
      toast.success(t('schedule.saved'));
      onClose();
    } catch (error) {
      setServerError(staffErrorMessage(error, t));
    }
  });

  const onDelete = async () => {
    if (!shift) return;
    try {
      await remove.mutateAsync(shift.id);
      toast.success(t('schedule.deleted'));
      onClose();
    } catch (error) {
      setServerError(staffErrorMessage(error, t));
    }
  };

  const errors = formState.errors;
  return (
    <Modal
      open
      onClose={onClose}
      title={shift ? t('schedule.editTitle') : t('schedule.createTitle')}
      description={t('schedule.overnightHint')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          {shift && (
            <Button variant="danger" onClick={() => void onDelete()} loading={remove.isPending}>
              {t('common:actions.delete')}
            </Button>
          )}
          <Button onClick={onClose} disabled={formState.isSubmitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form="shift-form" variant="primary" loading={formState.isSubmitting}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <FormGrid id="shift-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('fields.employee')} error={errors.userId?.message} required>
          <Select
            placeholder={t('fields.chooseEmployee')}
            options={members.map((member) => ({ value: member.userId, label: member.fullName }))}
            {...register('userId')}
          />
        </FormField>
        <FormField label={t('fields.date')} error={errors.date?.message} required>
          <Input type="date" {...register('date')} />
        </FormField>
        <FormField label={t('fields.start')} error={errors.startTime?.message} required>
          <Input type="time" {...register('startTime')} />
        </FormField>
        <FormField label={t('fields.end')} error={errors.endTime?.message} required>
          <Input type="time" {...register('endTime')} />
        </FormField>
        <FormField label={t('fields.roleNote')} error={errors.roleNote?.message}>
          <Input {...register('roleNote')} />
        </FormField>
        <FormField label={t('fields.note')} error={errors.note?.message}>
          <Input {...register('note')} />
        </FormField>
      </FormGrid>
    </Modal>
  );
}
