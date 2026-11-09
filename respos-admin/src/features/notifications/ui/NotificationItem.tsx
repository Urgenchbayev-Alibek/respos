import clsx from 'clsx';
import { AlertTriangle, Bell, ChefHat, ClipboardList, Package, PackageCheck, PlugZap } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { NotificationDto, NotificationType } from '@/entities/notification/notification.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import styles from './notifications.module.css';

const ICONS: Record<NotificationType, ReactNode> = {
  order_new: <ClipboardList />,
  order_status: <ClipboardList />,
  order_ready: <ChefHat />,
  stock_low: <Package />,
  purchase_received: <PackageCheck />,
  integration_error: <PlugZap />,
  system: <AlertTriangle />,
};

export interface NotificationItemProps {
  notification: NotificationDto;
  onOpen: (notification: NotificationDto) => void;
  compact?: boolean;
}

export function NotificationItem({ notification, onOpen, compact }: NotificationItemProps) {
  const { t } = useTranslation('notifications');
  const format = useFormatters();
  return (
    <button
      type="button"
      className={clsx(styles.item, !notification.isRead && styles.unread, compact && styles.compact)}
      onClick={() => onOpen(notification)}
    >
      <span className={styles.icon} aria-hidden="true">
        {ICONS[notification.type] ?? <Bell />}
      </span>
      <span className={styles.text}>
        <span className={styles.title}>
          {!notification.isRead && <span className="visually-hidden">{t('unreadMark')} </span>}
          {notification.title}
        </span>
        {notification.body && <span className={styles.body}>{notification.body}</span>}
        <span className={styles.meta}>
          {t(`type.${notification.type}`, { defaultValue: notification.type })} · {format.dateTime(notification.createdAt)}
        </span>
      </span>
    </button>
  );
}
