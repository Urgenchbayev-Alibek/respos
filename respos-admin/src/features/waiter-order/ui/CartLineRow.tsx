import { MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Input, StatusBadge } from '@/shared/ui';
import type { CartAction, CartLine } from '../model/cart';
import { QuantityStepper } from './QuantityStepper';
import styles from './OrderPanel.module.css';

export function CartLineRow({ line, dispatch }: { line: CartLine; dispatch: (action: CartAction) => void }) {
  const { t } = useTranslation('waiter');
  const format = useFormatters();
  const [editingComment, setEditingComment] = useState(false);
  const title = line.variantName ? `${line.name} · ${line.variantName}` : line.name;

  return (
    <li className={styles.line} data-testid="cart-line">
      <div className={styles.lineTop}>
        <span className={styles.lineName}>{title}</span>
        <StatusBadge domain="orderItem" status="new" size="sm" />
      </div>
      {line.modifierNames.length > 0 && <div className={styles.mods}>+ {line.modifierNames.join(', ')}</div>}
      {editingComment ? (
        <Input
          autoFocus
          aria-label={t('cart.comment', { name: title })}
          maxLength={200}
          value={line.comment}
          placeholder={t('cart.commentPlaceholder')}
          onChange={(event) => dispatch({ type: 'comment', key: line.key, comment: event.target.value })}
          onBlur={() => setEditingComment(false)}
          onKeyDown={(event) => event.key === 'Enter' && setEditingComment(false)}
        />
      ) : (
        line.comment && <div className={styles.comment}>{line.comment}</div>
      )}
      <div className={styles.lineBottom}>
        <QuantityStepper
          value={line.quantity}
          label={title}
          onChange={(value) => dispatch({ type: value > line.quantity ? 'increment' : 'decrement', key: line.key })}
          onRemove={() => dispatch({ type: 'remove', key: line.key })}
        />
        <button
          type="button"
          className={styles.commentButton}
          aria-label={t('cart.comment', { name: title })}
          onClick={() => setEditingComment(true)}
        >
          <MessageSquare aria-hidden="true" />
        </button>
        <span className={styles.sum}>{format.money(line.unitPrice * line.quantity)}</span>
      </div>
    </li>
  );
}
