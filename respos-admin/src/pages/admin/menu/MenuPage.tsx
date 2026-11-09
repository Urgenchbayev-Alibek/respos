import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { CategoriesPanel } from '@/features/menu/ui/CategoriesPanel';
import { MenuItemsPanel } from '@/features/menu/ui/MenuItemsPanel';
import { ModifierGroupsPanel } from '@/features/menu/ui/ModifierGroupsPanel';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { PageHeader, Tabs } from '@/shared/ui';

const TABS = ['items', 'categories', 'modifiers'] as const;
type MenuTab = (typeof TABS)[number];

function isMenuTab(value: string | null): value is MenuTab {
  return (TABS as readonly string[]).includes(value ?? '');
}

/** Menu management: dishes (stop-list, variants, modifiers, photo), categories (reorder), modifier groups. */
export function MenuPage() {
  const { t } = useTranslation('menu');
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.menu.manage);
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: MenuTab = isMenuTab(tabParam) ? tabParam : 'items';

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={hasPermission(PERMISSIONS.kitchen.read) && <Link to={ROUTES.admin.kitchenStations}>{t('stationsLink')}</Link>}
      />
      <Tabs
        ariaLabel={t('title')}
        value={tab}
        onChange={(id) => setParams(id === 'items' ? {} : { tab: id }, { replace: true })}
        items={TABS.map((id) => ({ id, label: t(`tabs.${id}`) }))}
      />
      {tab === 'items' && <MenuItemsPanel canManage={canManage} />}
      {tab === 'categories' && <CategoriesPanel canManage={canManage} />}
      {tab === 'modifiers' && <ModifierGroupsPanel canManage={canManage} />}
    </>
  );
}
