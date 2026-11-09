import { Bell } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useNotificationsRealtime,
  useUnreadNotificationCount,
} from '@/entities/notification/notification.queries';
import type { NotificationDto } from '@/entities/notification/notification.types';
import { safeNotificationLink } from '@/features/notifications/model/safe-link';
import { NotificationItem } from '@/features/notifications/ui/NotificationItem';
import styles from '@/features/notifications/ui/notifications.module.css';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { Button, EmptyState, ErrorState, IconButton, Skeleton } from '@/shared/ui';

const PREVIEW_SIZE = 6;
const MAX_BADGE = 99;

function BellPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('notifications');
  const navigate = useNavigate();
  const list = useNotifications({ page: 1, pageSize: PREVIEW_SIZE, sort: 'createdAt:desc' });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const open = (notification: NotificationDto) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    const link = safeNotificationLink(notification.link);
    if (link) {
      onClose();
      navigate(link);
    }
  };

  const items = list.data?.items ?? [];
  return (
    <>
      <div className={styles.panelHeader}>
        <h2>{t('title')}</h2>
        <Button size="sm" variant="ghost" loading={markAll.isPending} disabled={items.every((n) => n.isRead)} onClick={() => markAll.mutate()}>
          {t('markAllRead')}
        </Button>
      </div>
      {list.isLoading && <div className={styles.panelFooter}><Skeleton height={48} /></div>}
      {list.error && <ErrorState compact error={list.error} onRetry={() => void list.refetch()} />}
      {list.data && items.length === 0 && <EmptyState compact title={t('empty')} />}
      <ul className={styles.list}>
        {items.map((notification) => (
          <li key={notification.id}>
            <NotificationItem notification={notification} onOpen={open} compact />
          </li>
        ))}
      </ul>
      <div className={styles.panelFooter}>
        <Link to={ROUTES.admin.notifications} onClick={onClose}>
          {t('viewAll')}
        </Link>
      </div>
    </>
  );
}

/** Topbar bell: unread counter (REST + NotificationCreated hint), latest notifications, mark read / all. */
export function NotificationsBell() {
  const { t } = useTranslation('notifications');
  const { hasPermission } = usePermissions();
  const allowed = hasPermission(PERMISSIONS.notifications.read);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const unread = useUnreadNotificationCount(allowed);
  useNotificationsRealtime();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector<HTMLElement>('button')?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!allowed) return null;
  const count = unread.data ?? 0;
  const label = count > 0 ? t('bellUnread', { count }) : t('bell');

  return (
    <span ref={rootRef} className={styles.root}>
      <IconButton label={label} icon={<Bell />} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)} />
      {count > 0 && (
        <span className={styles.badge} aria-hidden="true" data-testid="notifications-unread-badge">
          {count > MAX_BADGE ? `${MAX_BADGE}+` : count}
        </span>
      )}
      {open && (
        <div id={panelId} role="dialog" aria-label={t('title')} className={styles.panel}>
          <BellPanel onClose={() => setOpen(false)} />
        </div>
      )}
    </span>
  );
}
