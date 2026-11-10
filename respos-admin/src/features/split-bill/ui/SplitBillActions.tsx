import { Combine, Split } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMergeBills } from '@/entities/billing/billing.queries';
import type { OrderDto } from '@/entities/order/order.types';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Button, ConfirmDialog, useToast } from '@/shared/ui';
import { canMergeBills, canSplitOrder } from '../model/split-math';
import { SplitBillModal } from './SplitBillModal';

/** "Split bill" / "Merge bills" buttons (orders.split). Hidden when not applicable. */
export function SplitBillActions({ order, size = 'md' }: { order: OrderDto; size?: 'sm' | 'md' | 'lg' }) {
  const { t } = useTranslation('billing');
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const merge = useMergeBills();
  const [open, setOpen] = useState<'split' | 'merge' | null>(null);

  const onMerge = async () => {
    try {
      await merge.mutateAsync(order.id);
      toast.success(t('split.merged'));
    } catch (error) {
      toast.error(getErrorMessage(error, t));
    } finally {
      setOpen(null);
    }
  };

  return (
    <>
      {canSplitOrder(order, hasPermission) && (
        <Button size={size} icon={<Split />} onClick={() => setOpen('split')}>
          {t('split.action')}
        </Button>
      )}
      {canMergeBills(order, hasPermission) && (
        <Button size={size} icon={<Combine />} onClick={() => setOpen('merge')}>
          {t('split.merge')}
        </Button>
      )}
      {open === 'split' && <SplitBillModal order={order} onClose={() => setOpen(null)} />}
      <ConfirmDialog
        open={open === 'merge'}
        danger={false}
        title={t('split.mergeTitle')}
        message={t('split.mergeDescription')}
        confirmLabel={t('split.merge')}
        loading={merge.isPending}
        onConfirm={() => void onMerge()}
        onCancel={() => setOpen(null)}
      />
    </>
  );
}
