import { CreditCard, KeyRound, MoreHorizontal, PauseCircle, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrganizationStatus } from '@/entities/platform/platform.queries';
import type { PlatformOrganizationDto } from '@/entities/platform/platform.types';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { ConfirmDialog, DropdownMenu, IconButton, useToast, type DropdownMenuItem } from '@/shared/ui';

export interface OrganizationRowActionsProps {
  organization: PlatformOrganizationDto;
  onSubscription: (organization: PlatformOrganizationDto) => void;
  onAccess: (organization: PlatformOrganizationDto) => void;
}

export function OrganizationRowActions({ organization, onSubscription, onAccess }: OrganizationRowActionsProps) {
  const { t } = useTranslation('platform');
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const status = useOrganizationStatus();
  const [pending, setPending] = useState<'suspend' | 'activate' | null>(null);

  const items: DropdownMenuItem[] = [];
  if (hasPermission(PERMISSIONS.platform.organizationsManage)) {
    items.push({ id: 'subscription', label: t('actions.subscription'), icon: <CreditCard />, onSelect: () => onSubscription(organization) });
    if (organization.status === 'active') {
      items.push({ id: 'suspend', label: t('actions.suspend'), icon: <PauseCircle />, danger: true, onSelect: () => setPending('suspend') });
    } else {
      items.push({ id: 'activate', label: t('actions.activate'), icon: <PlayCircle />, onSelect: () => setPending('activate') });
    }
  }
  if (hasPermission(PERMISSIONS.platform.tenantDataAccess)) {
    items.push({ id: 'access', label: t('actions.access'), icon: <KeyRound />, danger: true, onSelect: () => onAccess(organization) });
  }
  if (items.length === 0) return null;

  const confirm = async () => {
    if (!pending) return;
    try {
      await status.mutateAsync({ id: organization.id, action: pending });
      toast.success(t(`organizations.done.${pending}`, { name: organization.name }));
    } catch (error) {
      toast.error(t('organizations.actionFailed'), getErrorMessage(error, t));
    } finally {
      setPending(null);
    }
  };

  return (
    <span onClick={(event) => event.stopPropagation()}>
      <DropdownMenu
        items={items}
        trigger={(props) => <IconButton label={t('actions.menu', { name: organization.name })} icon={<MoreHorizontal />} {...props} />}
      />
      <ConfirmDialog
        open={pending !== null}
        danger={pending === 'suspend'}
        title={pending ? t(`confirm.${pending}Title`, { name: organization.name }) : ''}
        message={pending ? t(`confirm.${pending}Message`) : undefined}
        confirmLabel={pending ? t(`actions.${pending}`) : undefined}
        loading={status.isPending}
        onConfirm={() => void confirm()}
        onCancel={() => setPending(null)}
      />
    </span>
  );
}
