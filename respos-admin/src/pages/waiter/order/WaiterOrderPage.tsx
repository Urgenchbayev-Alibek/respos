import { ArrowLeft } from 'lucide-react';
import { useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usePosMenu } from '@/entities/menu/menu.queries';
import { localizedName, type MenuItemDto } from '@/entities/menu/menu.types';
import { useOrder, useServeAllItems, useServeOrderItem } from '@/entities/order/order.queries';
import { formatOrderNumber, isOrderOpen, type OrderType } from '@/entities/order/order.types';
import { useTables } from '@/entities/table/table.queries';
import { OrderActions } from '@/features/order-actions/ui/OrderActions';
import { cartQuantity, cartReducer } from '@/features/waiter-order/model/cart';
import { useSubmitOrder, type NewOrderDraft } from '@/features/waiter-order/model/use-submit-order';
import { useWaiterRealtime } from '@/features/waiter-order/model/use-waiter-realtime';
import { ItemOptionsSheet } from '@/features/waiter-order/ui/ItemOptionsSheet';
import { OrderPanel } from '@/features/waiter-order/ui/OrderPanel';
import { PosMenu } from '@/features/waiter-order/ui/PosMenu';
import { isApiError } from '@/shared/api/api-error';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { buildPath, ROUTES } from '@/shared/constants/routes';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { ErrorState, IconButton, PageLoader, StatusBadge, Tabs, useToast } from '@/shared/ui';
import styles from './WaiterOrderPage.module.css';

function readDraft(params: URLSearchParams): NewOrderDraft {
  const type: OrderType = params.get('type') === 'takeaway' ? 'takeaway' : 'dine_in';
  const guests = Number(params.get('guests'));
  return {
    type,
    tableId: type === 'dine_in' ? (params.get('tableId') ?? undefined) : undefined,
    guestCount: Number.isInteger(guests) && guests > 0 ? guests : 1,
  };
}

/** Waiter order screen (`/waiter/orders/new?tableId=&guests=` and `/waiter/orders/:orderId`). */
export function WaiterOrderPage() {
  const { t, i18n } = useTranslation('waiter');
  const toast = useToast();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const { hasPermission } = usePermissions();
  const draft = orderId ? null : readDraft(params);
  const order = useOrder(orderId);
  const menu = usePosMenu();
  const tables = useTables();
  const [lines, dispatch] = useReducer(cartReducer, []);
  const [picking, setPicking] = useState<MenuItemDto | null>(null);
  const [mobileTab, setMobileTab] = useState<'menu' | 'bill'>('menu');
  const [sendError, setSendError] = useState<string | null>(null);
  const { submit, isPending } = useSubmitOrder(orderId, draft);
  const serve = useServeOrderItem();
  const serveAll = useServeAllItems();
  useWaiterRealtime();

  const data = order.data;
  const canEdit = data
    ? hasPermission(PERMISSIONS.orders.update) && isOrderOpen(data)
    : !orderId && hasPermission(PERMISSIONS.orders.create);
  const tableId = data?.tableId ?? draft?.tableId;
  const tableNumber = data?.tableNumber ?? tables.data?.find((table) => table.id === tableId)?.number;
  const isTakeaway = (data?.type ?? draft?.type) === 'takeaway';

  const pick = (item: MenuItemDto) => {
    if (!canEdit) return;
    if (item.variants.length > 0 || item.modifierGroups.length > 0) {
      setPicking(item);
      return;
    }
    const name = localizedName(item, i18n.language);
    dispatch({
      type: 'add',
      line: {
        menuItemId: item.id,
        name,
        unitPrice: item.price,
        modifierOptionIds: [],
        modifierNames: [],
        quantity: 1,
        comment: '',
      },
    });
  };

  const send = async () => {
    setSendError(null);
    const result = await submit(lines, () => dispatch({ type: 'clear' }));
    if (result.error) {
      setSendError(getErrorMessage(result.error, t));
      if (isApiError(result.error) && result.error.status === 409) void order.refetch();
    } else {
      toast.success(t('toast.sent'));
    }
    if (!orderId && result.orderId) navigate(buildPath(ROUTES.waiter.order, { orderId: result.orderId }), { replace: true });
  };

  const runServe = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      toast.error(t('toast.serveFailed'), getErrorMessage(error, t));
    }
  };

  if (orderId && order.isLoading) return <PageLoader />;
  if (orderId && order.error && !data) return <ErrorState error={order.error} onRetry={() => void order.refetch()} />;

  const title = isTakeaway ? t('order.takeaway') : t('order.table', { number: tableNumber ?? '—' });
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <IconButton
          label={t('order.back')}
          icon={<ArrowLeft />}
          variant="secondary"
          size="lg"
          onClick={() => navigate(ROUTES.waiter.tables)}
        />
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>
            {title}
            {data && <span className={styles.number}> · {formatOrderNumber(data.number)}</span>}
          </h1>
          <p className={styles.subtitle}>
            {t('order.guests', { guests: data?.guestCount ?? draft?.guestCount ?? 1 })}
            {!data && ` · ${t('order.newOrder')}`}
          </p>
        </div>
        {data && <StatusBadge domain="order" status={data.status} size="lg" />}
        {data && (
          <div className={styles.headerActions}>
            <OrderActions order={data} />
          </div>
        )}
      </header>
      <div className={styles.mobileTabs}>
        <Tabs
          ariaLabel={t('order.panel')}
          value={mobileTab}
          onChange={(id) => setMobileTab(id as 'menu' | 'bill')}
          items={[
            { id: 'menu', label: t('menu.title') },
            { id: 'bill', label: t('order.billTab', { n: cartQuantity(lines) + (data?.items.length ?? 0) }) },
          ]}
        />
      </div>
      <div className={styles.body} data-mobile-tab={mobileTab}>
        <div className={styles.menuCol}>
          {menu.error && !menu.data ? (
            <ErrorState error={menu.error} onRetry={() => void menu.refetch()} />
          ) : menu.data ? (
            canEdit ? (
              <PosMenu categories={menu.data} onPick={pick} />
            ) : (
              <p className={styles.readOnly}>{t('order.readOnly')}</p>
            )
          ) : (
            <PageLoader />
          )}
        </div>
        <div className={styles.billCol}>
          <OrderPanel
            order={data}
            lines={lines}
            dispatch={dispatch}
            canEdit={canEdit}
            sending={isPending}
            sendError={sendError}
            onSend={() => void send()}
            onServe={(itemId) => orderId && void runServe(() => serve.mutateAsync({ orderId, itemId }))}
            onServeAll={() => orderId && void runServe(() => serveAll.mutateAsync(orderId))}
            servingItemId={serve.isPending ? (serve.variables?.itemId ?? null) : null}
          />
        </div>
      </div>
      {picking && (
        <ItemOptionsSheet
          item={picking}
          onClose={() => setPicking(null)}
          onAdd={(line) => {
            dispatch({ type: 'add', line });
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}
