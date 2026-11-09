import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useBranches } from '@/entities/branch/branch.queries';
import { useRoles } from '@/entities/role/role.queries';
import { useCreateUser, useInviteUser, useUpdateUser } from '@/entities/user/user.queries';
import type { InvitationResult, UserDto } from '@/entities/user/user.types';
import { applyServerCodeError, applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, FormGrid, Input, Modal, useToast } from '@/shared/ui';
import { schemaForMode, type UserFormMode, type UserFormValues } from '../model/user-schemas';
import { CheckboxGroup } from './CheckboxGroup';
import { InviteLinkResult } from './InviteLinkResult';

export interface UserFormModalProps {
  open: boolean;
  mode: UserFormMode;
  user?: UserDto | null;
  onClose: () => void;
}

const FIELDS = ['email', 'fullName', 'phone', 'password', 'roleIds', 'branchIds'] as const;
const CODE_FIELDS = { 'user.email_taken': 'email', 'user.invalid_roles': 'roleIds', 'user.invalid_branches': 'branchIds' } as const;

function initialValues(user?: UserDto | null): UserFormValues {
  return {
    email: user?.email ?? '',
    fullName: user?.fullName ?? '',
    phone: user?.phone ?? '',
    password: '',
    roleIds: user?.roles.map((role) => role.id) ?? [],
    branchIds: user?.branches.map((branch) => branch.id) ?? [],
  };
}

/** Invite / create / edit user (roles + branch access). */
export function UserFormModal({ open, mode, user, onClose }: UserFormModalProps) {
  const { t } = useTranslation('users');
  const toast = useToast();
  const roles = useRoles();
  const branches = useBranches();
  const invite = useInviteUser();
  const create = useCreateUser();
  const update = useUpdateUser();
  const [serverError, setServerError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationResult | null>(null);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(schemaForMode(mode)) as unknown as Resolver<UserFormValues>,
    defaultValues: initialValues(user),
  });
  const { register, control, handleSubmit, reset, setError, formState } = form;

  useEffect(() => {
    if (!open) return;
    reset(initialValues(user));
    setServerError(null);
    setInvitation(null);
  }, [open, user, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const common = { fullName: values.fullName, roleIds: values.roleIds, branchIds: values.branchIds };
    const phone = values.phone || undefined;
    try {
      if (mode === 'invite') {
        setInvitation(await invite.mutateAsync({ ...common, email: values.email }));
        return;
      }
      if (mode === 'create') await create.mutateAsync({ ...common, phone, email: values.email, password: values.password });
      else if (user) await update.mutateAsync({ id: user.id, input: { ...common, phone } });
      toast.success(t(mode === 'create' ? 'toast.created' : 'toast.updated'));
      onClose();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, FIELDS) && !applyServerCodeError(error, setError, CODE_FIELDS, t)) {
        setServerError(getErrorMessage(error, t));
      }
    }
  });

  const errors = formState.errors;
  const title = t(`form.title.${mode}`);
  if (invitation) {
    return (
      <Modal open={open} onClose={onClose} title={title} footer={<Button onClick={onClose}>{t('common:actions.close')}</Button>}>
        <InviteLinkResult link={invitation.inviteLink} />
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      dismissible={!formState.isSubmitting}
      footer={
        <>
          <Button onClick={onClose} disabled={formState.isSubmitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="primary" type="submit" form="user-form" loading={formState.isSubmitting}>
            {t(`form.submit.${mode}`)}
          </Button>
        </>
      }
    >
      <FormGrid id="user-form" columns={2} onSubmit={onSubmit}>
        {serverError && <div data-span="full"><Alert>{serverError}</Alert></div>}
        <FormField label={t('fields.fullName')} error={errors.fullName?.message} required>
          <Input autoComplete="off" data-autofocus {...register('fullName')} />
        </FormField>
        <FormField label={t('fields.email')} error={errors.email?.message} required={mode !== 'edit'}>
          <Input type="email" autoComplete="off" disabled={mode === 'edit'} {...register('email')} />
        </FormField>
        {mode !== 'invite' && (
          <FormField label={t('fields.phone')} error={errors.phone?.message}>
            <Input type="tel" autoComplete="off" {...register('phone')} />
          </FormField>
        )}
        {mode === 'create' && (
          <FormField label={t('fields.tempPassword')} error={errors.password?.message} hint={t('auth:passwordPolicy')} required>
            <Input type="password" autoComplete="new-password" {...register('password')} />
          </FormField>
        )}
        <Controller
          control={control}
          name="roleIds"
          render={({ field }) => (
            <CheckboxGroup
              legend={t('fields.roles')}
              options={(roles.data ?? []).map((role) => ({ value: role.id, label: role.name }))}
              value={field.value}
              onChange={field.onChange}
              errorText={errors.roleIds?.message ? t(errors.roleIds.message) : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="branchIds"
          render={({ field }) => (
            <CheckboxGroup
              legend={t('fields.branches')}
              hint={t('form.branchesHint')}
              options={(branches.data ?? []).filter((b) => b.isActive).map((b) => ({ value: b.id, label: b.name }))}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </FormGrid>
    </Modal>
  );
}
