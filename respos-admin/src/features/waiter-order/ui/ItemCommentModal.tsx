import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderItemDto } from '@/entities/order/order.types';
import { Button, FormField, Modal, Textarea } from '@/shared/ui';

export interface ItemCommentModalProps {
  item: OrderItemDto;
  saving: boolean;
  onSave: (comment: string | null) => void | Promise<void>;
  onClose: () => void;
}

/** Kitchen note for a saved, not-yet-sent item. Empty text clears the note. */
export function ItemCommentModal({ item, saving, onSave, onClose }: ItemCommentModalProps) {
  const { t } = useTranslation('waiter');
  const [comment, setComment] = useState(item.comment ?? '');

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      dismissible={!saving}
      title={t('cart.comment', { name: item.name })}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void onSave(comment.trim() || null)}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <FormField label={t('options.comment')}>
        <Textarea
          data-autofocus
          maxLength={500}
          value={comment}
          placeholder={t('cart.commentPlaceholder')}
          onChange={(event) => setComment(event.target.value)}
        />
      </FormField>
    </Modal>
  );
}
