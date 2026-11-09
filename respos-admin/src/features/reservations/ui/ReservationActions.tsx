import { Armchair, Ban, CheckCheck, CheckCircle2, MoreHorizontal, Pencil, UserX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useReservationAction } from '@/entities/reservation/reservation.queries';
import {
  EDITABLE_RESERVATION_STATUSES,
  RESERVATION_ACTIONS,
  type ReservationAction,
  type ReservationDto,
} from '@/entities/reservation/reservation.types';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Button, ConfirmDialog, DropdownMenu, IconButton, useToast, type DropdownMenuItem } from '@/shared/ui';

const ICONS: Record<ReservationAction, ReactNode> = {
  confirm: <CheckCircle2 />,
  seat: <Armchair />,
  complete: <CheckCheck />,
  cancel: <Ban />,
  'no-show': <UserX />,
};
const DANGEROUS: readonly ReservationAction[] = ['cancel', 'no-show'];

export interface ReservationActionsProps {
  reservation: ReservationDto;
  onEdit?: (reservation: ReservationDto) => void;
  /** `buttons` in the details drawer, `menu` in table rows. */
  variant?: 'buttons' | 'menu';
  onDone?: () => void;
}

/** confirm / seat / complete / cancel (optional reason) / no-show; dangerous ones are confirmed first. */
export function ReservationActions({ reservation, onEdit, variant = 'buttons', onDone }: ReservationActionsProps) {
  const { t } = useTranslation('reservations');
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const mutation = useReservationAction();
  const [pending, setPending] = useState<ReservationAction | null>(null);
  if (!hasPermission(PERMISSIONS.reservations.manage)) return null;

  const actions = RESERVATION_ACTIONS[reservation.status];
  const canEdit = Boolean(onEdit) && EDITABLE_RESERVATION_STATUSES.includes(reservation.status);

  const run = async (action: ReservationAction, reason?: string) => {
    try {
      await mutation.mutateAsync({ id: reservation.id, action, reason });
      toast.success(t(`toast.${action}`));
      onDone?.();
    } catch (error) {
      toast.error(t('toast.actionFailed'), getErrorMessage(error, t));
    } finally {
      setPending(null);
    }
  };
  const trigger = (action: ReservationAction) => (DANGEROUS.includes(action) ? setPending(action) : void run(action));

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title={pending ? t(`confirm.${pending}Title`) : ''}
      message={t('confirm.message', { name: reservation.guestName })}
      confirmLabel={pending ? t(`actions.${pending}`) : undefined}
      withReason={pending === 'cancel'}
      loading={mutation.isPending}
      onConfirm={(reason) => pending && void run(pending, reason)}
      onCancel={() => setPending(null)}
    />
  );

  if (variant === 'menu') {
    const items: DropdownMenuItem[] = [
      ...(canEdit && onEdit
        ? [{ id: 'edit', label: t('actions.edit'), icon: <Pencil />, onSelect: () => onEdit(reservation) }]
        : []),
      ...actions.map((action) => ({
        id: action,
        label: t(`actions.${action}`),
        icon: ICONS[action],
        danger: DANGEROUS.includes(action),
        onSelect: () => trigger(action),
      })),
    ];
    if (items.length === 0) return null;
    return (
      <span onClick={(event) => event.stopPropagation()}>
        <DropdownMenu
          items={items}
          trigger={(props) => (
            <IconButton label={t('actions.menu', { name: reservation.guestName })} icon={<MoreHorizontal />} {...props} />
          )}
        />
        {dialog}
      </span>
    );
  }

  return (
    <>
      {canEdit && onEdit && (
        <Button icon={<Pencil />} onClick={() => onEdit(reservation)}>
          {t('actions.edit')}
        </Button>
      )}
      {actions.map((action) => (
        <Button
          key={action}
          icon={ICONS[action]}
          variant={action === 'confirm' || action === 'seat' || action === 'complete' ? 'primary' : 'secondary'}
          loading={mutation.isPending && mutation.variables?.action === action}
          onClick={() => trigger(action)}
        >
          {t(`actions.${action}`)}
        </Button>
      ))}
      {dialog}
    </>
  );
}
