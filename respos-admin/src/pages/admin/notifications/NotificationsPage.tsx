import { CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useNotificationsRealtime,
} from '@/entities/notification/notification.queries';
import type { NotificationDto } from '@/entities/notification/notification.types';
import { safeNotificationLink } from '@/features/notifications/model/safe-link';
import { NotificationItem } from '@/features/notifications/ui/NotificationItem';
import styles from '@/features/notifications/ui/notifications.module.css';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { DEFAULT_PAGE_SIZE } from '@/shared/types/pagination';
import { Button, Card, EmptyState, ErrorState, PageHeader, Pagination, Skeleton, Tabs, useToast } from '@/shared/ui';

export function NotificationsPage() {
  const { t } = useTranslation('notifications');
  const toast = useToast();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const query = useNotifications({ page, pageSize: DEFAULT_PAGE_SIZE, sort: 'createdAt:desc', unreadOnly: filter === 'unread' || undefined });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  useNotificationsRealtime();

  const open = (notification: NotificationDto) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    const link = safeNotificationLink(notification.link);
    if (link) navigate(link);
  };

  const readAll = async () => {
    try {
      await markAll.mutateAsync();
      toast.success(t('allRead'));
    } catch (error) {
      toast.error(t('markFailed'), getErrorMessage(error, t));
    }
  };

  const items = query.data?.items ?? [];
  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={<Button icon={<CheckCheck />} loading={markAll.isPending} onClick={() => void readAll()}>{t('markAllRead')}</Button>}
      />
      <Tabs
        ariaLabel={t('title')}
        items={[{ id: 'all', label: t('filterAll') }, { id: 'unread', label: t('filterUnread') }]}
        value={filter}
        onChange={(id) => { setFilter(id as 'all' | 'unread'); setPage(1); }}
      />
      <Card flush>
        {query.isLoading && <Skeleton height={64} />}
        {query.error && !query.data && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
        {query.data && items.length === 0 && <EmptyState title={filter === 'unread' ? t('emptyUnread') : t('empty')} />}
        <ul className={styles.list} aria-label={t('title')}>
          {items.map((notification) => (
            <li key={notification.id}>
              <NotificationItem notification={notification} onOpen={open} />
            </li>
          ))}
        </ul>
        {query.data && query.data.totalCount > 0 && (
          <Pagination page={page} pageSize={query.data.pageSize} totalCount={query.data.totalCount} onPageChange={setPage} disabled={query.isFetching} />
        )}
      </Card>
    </>
  );
}
