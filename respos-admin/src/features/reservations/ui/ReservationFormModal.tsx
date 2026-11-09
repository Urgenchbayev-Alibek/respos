import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { DiningAreaDto } from '@/entities/dining-area/dining-area.types';
import { useSaveReservation } from '@/entities/reservation/reservation.queries';
import type { ReservationDto, ReservationInput } from '@/entities/reservation/reservation.types';
import type { TableDto } from '@/entities/table/table.types';
import { isApiError } from '@/shared/api/api-error';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Input, Modal, Select, Textarea, useToast } from '@/shared/ui';
import {
  RESERVATION_FIELDS,
  reservationSchema,
  toFormValues,
  toReservationInput,
  type ReservationFormOutput,
  type ReservationFormValues,
} from '../model/reservation-form';

export const RESERVATION_CONFLICT_CODE = 'reservation.time_conflict';

export interface ReservationFormModalProps {
  reservation: ReservationDto | null;
  /** Default day for a new reservation (`YYYY-MM-DD`, branch timezone). */
  date: string;
  tables: TableDto[];
  areas: DiningAreaDto[];
  onClose: () => void;
  /** Called on 409 `reservation.time_conflict` so the page can highlight the overlapping reservation. */
  onConflict?: (input: ReservationInput) => void;
}

export function ReservationFormModal({ reservation, date, tables, areas, onClose, onConflict }: ReservationFormModalProps) {
  const { t } = useTranslation('reservations');
  const toast = useToast();
  const { timeZone } = useFormatters();
  const save = useSaveReservation();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<ReservationFormValues, unknown, ReservationFormOutput>({
    resolver: zodResolver(reservationSchema),
    defaultValues: toFormValues(reservation, date, timeZone),
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const input = toReservationInput(values, timeZone);
    try {
      await save.mutateAsync({ id: reservation?.id, input });
      toast.success(t(reservation ? 'toast.updated' : 'toast.created'));
      onClose();
    } catch (error) {
      if (isApiError(error) && error.code === RESERVATION_CONFLICT_CODE) {
        const message = getErrorMessage(error, t);
        setServerError(message);
        setError('tableId', { type: 'server', message: 'reservations:conflictField' });
        onConflict?.(input);
        return;
      }
      if (!applyServerFieldErrors(error, setError, RESERVATION_FIELDS)) setServerError(getErrorMessage(error, t));
    }
  });

  const errors = formState.errors;
  const tableOptions = tables.map((table) => ({
    value: table.id,
    label: t('tableOption', { number: table.number, area: table.areaName, seats: table.capacity }),
  }));

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={t(reservation ? 'form.editTitle' : 'form.createTitle')}
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button type="submit" form="reservation-form" variant="primary" loading={formState.isSubmitting}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <FormGrid id="reservation-form" columns={2} onSubmit={onSubmit}>
        {serverError && (
          <div data-span="full">
            <Alert>{serverError}</Alert>
          </div>
        )}
        <FormField label={t('fields.guestName')} error={errors.guestName?.message} required>
          <Input data-autofocus autoComplete="off" {...register('guestName')} />
        </FormField>
        <FormField label={t('fields.guestPhone')} error={errors.guestPhone?.message} required>
          <Input type="tel" autoComplete="off" {...register('guestPhone')} />
        </FormField>
        <FormField label={t('fields.date')} error={errors.date?.message} required>
          <Input type="date" {...register('date')} />
        </FormField>
        <FormField label={t('fields.guestCount')} error={errors.guestCount?.message} required>
          <Input type="number" inputMode="numeric" min={1} {...register('guestCount')} />
        </FormField>
        <FormField label={t('fields.startTime')} error={errors.startTime?.message} required>
          <Input type="time" step={900} {...register('startTime')} />
        </FormField>
        <FormField label={t('fields.endTime')} error={errors.endTime?.message} required>
          <Input type="time" step={900} {...register('endTime')} />
        </FormField>
        <FormField label={t('fields.table')} error={errors.tableId?.message} hint={t('fields.tableHint')}>
          <Select placeholder={t('fields.noTable')} options={tableOptions} {...register('tableId')} />
        </FormField>
        <FormField label={t('fields.preferredArea')} error={errors.preferredAreaId?.message}>
          <Select
            placeholder={t('fields.anyArea')}
            options={areas.map((area) => ({ value: area.id, label: area.name }))}
            {...register('preferredAreaId')}
          />
        </FormField>
        <div data-span="full">
          <FormField label={t('fields.comment')} error={errors.comment?.message}>
            <Textarea rows={2} maxLength={500} {...register('comment')} />
          </FormField>
        </div>
      </FormGrid>
    </Modal>
  );
}
