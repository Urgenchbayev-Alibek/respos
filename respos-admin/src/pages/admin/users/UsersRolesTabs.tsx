import { useTranslation } from 'react-i18next';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { Tabs, type TabItem } from '@/shared/ui';

/** "Users & Roles" section switch (route tabs). */
export function UsersRolesTabs() {
  const { t } = useTranslation('users');
  const { hasPermission } = usePermissions();
  const items: TabItem[] = [];
  if (hasPermission(PERMISSIONS.users.read)) items.push({ id: 'users', label: t('tabs.users'), to: ROUTES.admin.users });
  if (hasPermission(PERMISSIONS.roles.read)) items.push({ id: 'roles', label: t('tabs.roles'), to: ROUTES.admin.roles });
  return <Tabs items={items} ariaLabel={t('tabs.label')} />;
}
