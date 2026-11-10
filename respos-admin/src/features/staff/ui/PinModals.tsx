import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSetMemberPin } from '@/entities/staff/staff.queries';
import type { StaffMemberDto } from '@/entities/staff/staff.types';
import { useRegisterDevice } from '@/features/shared-device/model/shared-device';
import { Alert, Button, FormField, FormGrid, Input, Modal, useToast } from '@/shared/ui';
import { staffErrorMessage } from '../model/staff-errors';
import { deviceSchema, memberPinSchema, type DeviceValues, type MemberPinValues } from '../model/staff-schemas';

/** Manager sets an employee's PIN (onboarding staff without their own login). Audited server-side. */
export function MemberPinModal({ member, onClose }: { member: StaffMemberDto; onClose: () => void }) {
  const { t } = useTranslation('staff');
  const toast = useToast();
  const setPin = useSetMemberPin();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<MemberPinValues>({ resolver: zodResolver(memberPinSchema), defaultValues: { pin: '' } });

  const onSubmit = handleSubmit(async ({ pin }) => {
    setServerError(null);
    try {
      await setPin.mutateAsync({ userId: member.userId, pin });
      toast.success(t('members.pinSaved'));
      onClose();
    } catch (error) {
      setServerError(staffErrorMessage(error, t));
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t('members.setPinTitle', { name: member.fullName })}
      description={t('pin.policy')}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button type="submit" form="member-pin-form" variant="primary" loading={formState.isSubmitting}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <FormGrid id="member-pin-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('pin.new')} error={formState.errors.pin?.message} required>
          <Input type="password" inputMode="numeric" autoComplete="off" maxLength={6} {...register('pin')} />
        </FormField>
      </FormGrid>
    </Modal>
  );
}

/** Turns this browser into a shared device of the current branch; then the manager is signed out to the lock screen. */
export function RegisterDeviceModal({ onClose, onRegistered }: { onClose: () => void; onRegistered: () => void }) {
  const { t } = useTranslation('staff');
  const registerDevice = useRegisterDevice();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<DeviceValues>({ resolver: zodResolver(deviceSchema), defaultValues: { name: '' } });

  const onSubmit = handleSubmit(async ({ name }) => {
    setServerError(null);
    try {
      await registerDevice.mutateAsync({ name });
      onRegistered();
    } catch (error) {
      setServerError(staffErrorMessage(error, t));
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t('devices.registerTitle')}
      description={t('devices.registerHint')}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button type="submit" form="device-form" variant="primary" loading={formState.isSubmitting}>
            {t('devices.register')}
          </Button>
        </>
      }
    >
      <FormGrid id="device-form" onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <FormField label={t('devices.name')} error={formState.errors.name?.message} required>
          <Input placeholder={t('devices.namePlaceholder')} {...register('name')} />
        </FormField>
      </FormGrid>
    </Modal>
  );
}
