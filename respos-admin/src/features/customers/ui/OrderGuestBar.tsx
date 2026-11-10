import { UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDetachCustomer } from '@/entities/customer/customer.queries';
import { isOrderOpen, type OrderDto } from '@/entities/order/order.types';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Button, IconButton, useToast } from '@/shared/ui';
import { AttachGuestModal } from './AttachGuestModal';
import { CustomerBadges } from './CustomerBadges';
import styles from './OrderGuestBar.module.css';

/** Guest of the order with birthday/VIP/points badges; attach / change / detach (waiter and cashier). */
export function OrderGuestBar({ order }: { order: OrderDto }) {
  const { t } = useTranslation('customers');
  const toast = useToast();
  const { hasPermission, hasAny } = usePermissions();
  const [open, setOpen] = useState(false);
  const detach = useDetachCustomer();
  const canRead = hasPermission(PERMISSIONS.customers.read);
  const canChange =
    canRead && isOrderOpen(order) && hasAny([PERMISSIONS.orders.update, PERMISSIONS.payments.create]) && !order.loyaltyDiscountAmount;
  const guest = order.customer ?? null;
  if (!canRead) return null;

  const remove = async () => {
    try {
      await detach.mutateAsync(order.id);
    } catch (error) {
      toast.error(t('toast.detachFailed'), getErrorMessage(error, t));
    }
  };

  return (
    <div className={styles.bar} aria-label={t('guestBar.label')} role="group">
      <UserRound aria-hidden="true" className={styles.icon} />
      {guest ? (
        <>
          <span className={styles.name}>
            <strong>{guest.name}</strong> <span className={styles.phone}>{guest.phone}</span>
          </span>
          <CustomerBadges isVip={guest.isVip} isBirthdayToday={guest.isBirthdayToday} points={guest.points} />
          {canChange && (
            <span className={styles.actions}>
              <Button size="sm" onClick={() => setOpen(true)}>{t('guestBar.change')}</Button>
              <IconButton label={t('guestBar.detach')} icon={<X />} size="sm" onClick={() => void remove()} disabled={detach.isPending} />
            </span>
          )}
        </>
      ) : (
        <>
          <span className={styles.empty}>{t('guestBar.none')}</span>
          {canChange && (
            <Button size="sm" className={styles.actions} onClick={() => setOpen(true)}>
              {t('guestBar.attach')}
            </Button>
          )}
        </>
      )}
      <AttachGuestModal orderId={order.id} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
