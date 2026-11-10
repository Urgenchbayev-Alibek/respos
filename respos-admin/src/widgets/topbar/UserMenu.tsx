import { LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/shared/constants/routes';
import { useAuth } from '@/shared/hooks/use-auth';
import { useTheme } from '@/shared/hooks/use-theme';
import { THEME_PREFERENCES, type ThemePreference } from '@/shared/lib/theme';
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

const THEME_ICONS: Record<ThemePreference, ReactNode> = { system: <Monitor />, light: <Sun />, dark: <Moon /> };

/** User menu: profile, colour theme (per device; hidden on KDS which is always dark), logout. */
export function UserMenu({ showTheme = true }: { showTheme?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const theme = useTheme();
  if (!user) return null;
  const themeItems = showTheme
    ? THEME_PREFERENCES.map((preference) => ({
        id: `theme-${preference}`,
        label: t(`ux:theme.${preference}`),
        icon: THEME_ICONS[preference],
        selected: theme.preference === preference,
        onSelect: () => theme.setPreference(preference),
      }))
    : [];

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
        ...themeItems,
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
