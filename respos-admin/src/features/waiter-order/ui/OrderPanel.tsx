import { CheckCheck, ChefHat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OrderDto } from '@/entities/order/order.types';
import { OrderItemsList } from '@/features/orders/ui/OrderItemsList';
import { OrderTotals } from '@/features/orders/ui/OrderTotals';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Alert, Button } from '@/shared/ui';
import { cartPreviewTotal, cartQuantity, type CartAction, type CartLine } from '../model/cart';
import { CartLineRow } from './CartLineRow';
import styles from './OrderPanel.module.css';
import { ServerItemControls } from './ServerItemControls';

export interface OrderPanelProps {
  order: OrderDto | undefined;
  lines: CartLine[];
  dispatch: (action: CartAction) => void;
  canEdit: boolean;
  sending: boolean;
  sendError: string | null;
  onSend: () => void;
  onServe: (itemId: string) => void;
  onServeAll: () => void;
  servingItemId: string | null;
}

/** Bill panel: server items with statuses, local cart of new items, server totals, send to kitchen. */
export function OrderPanel(props: OrderPanelProps) {
  const { order, lines, dispatch, canEdit, sending, sendError, onSend, onServe, onServeAll, servingItemId } = props;
  const { t } = useTranslation('waiter');
  const format = useFormatters();
  const serverNew = order?.items.filter((item) => item.status === 'new').length ?? 0;
  const toSend = cartQuantity(lines) + serverNew;
  const readyCount = order?.items.filter((item) => item.status === 'ready').length ?? 0;
  const items = order?.items ?? [];

  return (
    <aside className={styles.panel} aria-label={t('order.panel')}>
      <div className={styles.lines}>
        {items.length > 0 && (
          <OrderItemsList
            items={items}
            renderActions={(item) => (
              <>
                {order && <ServerItemControls order={order} item={item} canEdit={canEdit} />}
                {item.status === 'ready' && canEdit && (
                  <Button
                    size="sm"
                    variant="primary"
                    loading={servingItemId === item.id}
                    onClick={() => onServe(item.id)}
                    aria-label={t('order.serveItem', { name: item.name })}
                  >
                    {t('order.serve')}
                  </Button>
                )}
              </>
            )}
          />
        )}
        {lines.length > 0 && (
          <ul className={styles.cart} aria-label={t('cart.title')}>
            {lines.map((line) => (
              <CartLineRow key={line.key} line={line} dispatch={dispatch} />
            ))}
          </ul>
        )}
        {items.length === 0 && lines.length === 0 && <p className={styles.empty}>{t('cart.empty')}</p>}
      </div>
      <div className={styles.footer}>
        {lines.length > 0 && (
          <div className={styles.preview}>
            <span>{t('cart.preview', { n: cartQuantity(lines) })}</span>
            <span>{format.money(cartPreviewTotal(lines))}</span>
          </div>
        )}
        {order && <OrderTotals order={order} compact />}
        {sendError && <Alert>{sendError}</Alert>}
        {readyCount > 1 && canEdit && (
          <Button fullWidth size="lg" icon={<CheckCheck />} onClick={onServeAll}>
            {t('order.serveAll', { n: readyCount })}
          </Button>
        )}
        {canEdit && (
          <Button
            fullWidth
            size="lg"
            variant="primary"
            icon={<ChefHat />}
            loading={sending}
            disabled={toSend === 0}
            onClick={onSend}
          >
            {t('order.send', { n: toSend })}
          </Button>
        )}
      </div>
    </aside>
  );
}
