import { ArrowRightLeft, Percent } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderDto } from '@/entities/order/order.types';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { Button } from '@/shared/ui';
import { canApplyDiscount, canTransferOrder } from '../model/order-permissions';
import { DiscountModal } from './DiscountModal';
import { TransferTableModal } from './TransferTableModal';

export interface OrderActionsProps {
  order: OrderDto;
  size?: 'sm' | 'md' | 'lg';
}

/** "Discount" and "Move table" buttons with their modals; hidden without permission or on closed orders. */
export function OrderActions({ order, size = 'md' }: OrderActionsProps) {
  const { t } = useTranslation('orderActions');
  const { hasPermission } = usePermissions();
  const [open, setOpen] = useState<'discount' | 'transfer' | null>(null);
  const showDiscount = canApplyDiscount(order, hasPermission);
  const showTransfer = canTransferOrder(order, hasPermission);
  if (!showDiscount && !showTransfer) return null;

  return (
    <>
      {showDiscount && (
        <Button size={size} icon={<Percent />} onClick={() => setOpen('discount')}>
          {t('discount.action')}
        </Button>
      )}
      {showTransfer && (
        <Button size={size} icon={<ArrowRightLeft />} onClick={() => setOpen('transfer')}>
          {t('transfer.action')}
        </Button>
      )}
      {open === 'discount' && <DiscountModal order={order} onClose={() => setOpen(null)} />}
      {open === 'transfer' && <TransferTableModal order={order} onClose={() => setOpen(null)} />}
    </>
  );
}
