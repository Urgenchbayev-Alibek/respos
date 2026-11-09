import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { IconButton } from '@/shared/ui';
import styles from './TopbarTrigger.module.css';

/**
 * PLACEHOLDER bell: links to the notifications page.
 * The notifications feature should add the unread counter (GET /notifications/unread-count + NotificationCreated event).
 */
export function NotificationsBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  if (!hasPermission(PERMISSIONS.notifications.read)) return null;
  return (
    <span className={styles.bell}>
      <IconButton label={t('nav:topbar.notifications')} icon={<Bell />} onClick={() => navigate(ROUTES.admin.notifications)} />
    </span>
  );
}
