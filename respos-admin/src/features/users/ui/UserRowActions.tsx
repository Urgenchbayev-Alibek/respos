import { Ban, MoreHorizontal, Pencil, ShieldCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserAction } from '@/entities/user/user.queries';
import type { UserAction, UserDto } from '@/entities/user/user.types';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useAuth } from '@/shared/hooks/use-auth';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { ConfirmDialog, DropdownMenu, IconButton, useToast, type DropdownMenuItem } from '@/shared/ui';

export interface UserRowActionsProps {
  user: UserDto;
  onEdit: (user: UserDto) => void;
}

/** Edit / block / unblock / deactivate (dangerous actions confirmed). Server enforces self/last-owner rules. */
export function UserRowActions({ user, onEdit }: UserRowActionsProps) {
  const { t } = useTranslation('users');
  const toast = useToast();
  const { user: me } = useAuth();
  const { hasPermission } = usePermissions();
  const action = useUserAction();
  const [pending, setPending] = useState<UserAction | null>(null);
  const isSelf = me?.id === user.id;
  const canDeactivate = hasPermission(PERMISSIONS.users.deactivate) && !isSelf;

  const items: DropdownMenuItem[] = [];
  if (hasPermission(PERMISSIONS.users.update)) {
    items.push({ id: 'edit', label: t('actions.edit'), icon: <Pencil />, onSelect: () => onEdit(user) });
  }
  if (canDeactivate && user.status === 'active') {
    items.push({ id: 'block', label: t('actions.block'), icon: <Ban />, danger: true, onSelect: () => setPending('block') });
  }
  if (canDeactivate && user.status === 'blocked') {
    items.push({ id: 'unblock', label: t('actions.unblock'), icon: <ShieldCheck />, onSelect: () => setPending('unblock') });
  }
  if (canDeactivate && user.status !== 'deactivated') {
    items.push({ id: 'deactivate', label: t('actions.deactivate'), icon: <UserX />, danger: true, onSelect: () => setPending('deactivate') });
  }
  if (items.length === 0) return null;

  const confirm = async () => {
    if (!pending) return;
    try {
      await action.mutateAsync({ id: user.id, action: pending });
      toast.success(t(`toast.${pending}`));
    } catch (error) {
      toast.error(t('toast.actionFailed'), getErrorMessage(error, t));
    } finally {
      setPending(null);
    }
  };

  return (
    <span onClick={(event) => event.stopPropagation()}>
      <DropdownMenu
        items={items}
        trigger={(props) => <IconButton label={t('actions.menu', { name: user.fullName })} icon={<MoreHorizontal />} {...props} />}
      />
      <ConfirmDialog
        open={pending !== null}
        title={pending ? t(`confirm.${pending}Title`) : ''}
        message={pending ? t(`confirm.${pending}Message`, { name: user.fullName }) : undefined}
        confirmLabel={pending ? t(`actions.${pending}`) : undefined}
        danger={pending !== 'unblock'}
        loading={action.isPending}
        onConfirm={() => void confirm()}
        onCancel={() => setPending(null)}
      />
    </span>
  );
}
