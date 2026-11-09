import { LogOut, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/shared/constants/routes';
import { useAuth } from '@/shared/hooks/use-auth';
import { DropdownMenu } from '@/shared/ui';
import styles from './TopbarTrigger.module.css';

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <DropdownMenu
      header={
        <>
          <strong>{user.fullName}</strong>
          <br />
          {user.email}
        </>
      }
      items={[
        { id: 'profile', label: t('nav:topbar.profile'), icon: <UserRound />, onSelect: () => navigate(ROUTES.profile) },
        {
          id: 'logout',
          label: t('nav:topbar.logout'),
          icon: <LogOut />,
          danger: true,
          onSelect: () => void logout().then(() => navigate(ROUTES.login, { replace: true })),
        },
      ]}
      trigger={(props) => (
        <button type="button" className={styles.trigger} aria-label={t('nav:topbar.userMenu')} {...props}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(user.fullName) || '?'}
          </span>
          <span className={`${styles.label} ${styles.hideOnMobile}`}>{user.fullName}</span>
        </button>
      )}
    />
  );
}
