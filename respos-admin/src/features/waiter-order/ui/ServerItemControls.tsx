import { MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdateOrderItem } from '@/entities/order/order.queries';
import type { OrderDto, OrderItemDto, UpdateOrderItemInput } from '@/entities/order/order.types';
import { CancelItemButton } from '@/features/order-actions/ui/CancelItemButton';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { useToast } from '@/shared/ui';
import { ItemCommentModal } from './ItemCommentModal';
import styles from './OrderPanel.module.css';
import { QuantityStepper } from './QuantityStepper';

export interface ServerItemControlsProps {
  order: OrderDto;
  item: OrderItemDto;
  /** orders.update on an open order. */
  canEdit: boolean;
}

/**
 * Controls for an item already saved on the server: quantity/comment while it is still `new`
 * (`PUT /orders/{id}/items/{itemId}`), cancel with a reason (permission-gated).
 */
export function ServerItemControls({ order, item, canEdit }: ServerItemControlsProps) {
  const { t } = useTranslation('waiter');
  const toast = useToast();
  const update = useUpdateOrderItem();
  const [editingComment, setEditingComment] = useState(false);
  const editable = canEdit && item.status === 'new';

  const save = async (input: UpdateOrderItemInput) => {
    try {
      await update.mutateAsync({ orderId: order.id, itemId: item.id, input });
      return true;
    } catch (error) {
      toast.error(t('toast.itemUpdateFailed'), getErrorMessage(error, t));
      return false;
    }
  };

  return (
    <>
      {editable && (
        <>
          <QuantityStepper
            value={item.quantity}
            label={item.name}
            disabled={update.isPending}
            onChange={(quantity) => void save({ quantity, comment: item.comment })}
          />
          <button
            type="button"
            className={styles.commentButton}
            aria-label={t('cart.comment', { name: item.name })}
            onClick={() => setEditingComment(true)}
          >
            <MessageSquare aria-hidden="true" />
          </button>
        </>
      )}
      <CancelItemButton order={order} item={item} />
      {editingComment && (
        <ItemCommentModal
          item={item}
          saving={update.isPending}
          onClose={() => setEditingComment(false)}
          onSave={async (comment) => {
            if (await save({ quantity: item.quantity, comment })) setEditingComment(false);
          }}
        />
      )}
    </>
  );
}
