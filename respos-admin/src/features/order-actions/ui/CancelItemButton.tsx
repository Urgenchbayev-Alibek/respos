import { X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCancelOrderItem } from '@/entities/order/order.queries';
import type { OrderDto, OrderItemDto } from '@/entities/order/order.types';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { ConfirmDialog, IconButton, useToast } from '@/shared/ui';
import { canCancelItem } from '../model/order-permissions';

export interface CancelItemButtonProps {
  order: OrderDto;
  item: OrderItemDto;
  size?: 'sm' | 'md' | 'lg';
}

/** Cancel one order line with a required reason; sent items need orders.cancel (checked by the server too). */
export function CancelItemButton({ order, item, size = 'sm' }: CancelItemButtonProps) {
  const { t } = useTranslation('orderActions');
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const cancel = useCancelOrderItem();
  const [confirming, setConfirming] = useState(false);
  if (!canCancelItem(order, item, hasPermission)) return null;

  const run = async (reason: string) => {
    try {
      await cancel.mutateAsync({ orderId: order.id, itemId: item.id, reason });
      toast.success(t('cancelItem.done'));
      setConfirming(false);
    } catch (error) {
      toast.error(t('cancelItem.failed'), getErrorMessage(error, t));
    }
  };

  return (
    <>
      <IconButton
        size={size}
        variant="ghost"
        icon={<X />}
        label={t('cancelItem.action', { name: item.name })}
        onClick={() => setConfirming(true)}
      />
      <ConfirmDialog
        open={confirming}
        title={t('cancelItem.title', { name: item.name })}
        message={item.status === 'new' ? t('cancelItem.messageNew') : t('cancelItem.messageSent')}
        confirmLabel={t('cancelItem.confirm')}
        withReason
        reasonRequired
        loading={cancel.isPending}
        onConfirm={(reason) => void run(reason)}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
