import clsx from 'clsx';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import { ADMIN_NAV } from '@/app/navigation/admin.nav';
import { STORAGE_KEYS } from '@/shared/constants/locale';
import { BREAKPOINTS, useMediaQuery } from '@/shared/hooks/use-media-query';
import { safeStorage } from '@/shared/lib/safe-storage';
import { Drawer, IconButton } from '@/shared/ui';
import { BranchSwitcher } from '@/widgets/topbar/BranchSwitcher';
import { LanguageSwitcher } from '@/widgets/topbar/LanguageSwitcher';
import { NotificationsBell } from '@/widgets/topbar/NotificationsBell';
import { OrgSwitcher } from '@/widgets/topbar/OrgSwitcher';
import { TimeClockButton } from '@/widgets/topbar/TimeClockButton';
import { UserMenu } from '@/widgets/topbar/UserMenu';
import { Brand } from '../parts/Brand';
import { SideNav } from '../parts/SideNav';
import { SkipLink } from '../parts/SkipLink';
import { useBodyScope } from '../parts/use-body-scope';
import { WorkspaceSwitcher } from '../parts/WorkspaceSwitcher';
import styles from './AdminLayout.module.css';

/** Restaurant Admin Panel: collapsible sidebar (drawer on tablet/mobile) + topbar. */
export function AdminLayout() {
  const { t } = useTranslation();
  useBodyScope('admin');
  const isNarrow = useMediaQuery(BREAKPOINTS.tabletDown);
  const [collapsed, setCollapsed] = useState(() => safeStorage.get(STORAGE_KEYS.sidebarCollapsed) === '1');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navLabel = t('nav:admin.label');

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      safeStorage.set(STORAGE_KEYS.sidebarCollapsed, value ? '0' : '1');
      return !value;
    });
  };

  return (
    <div className={styles.shell} data-workspace="admin">
      <SkipLink />
      {!isNarrow && (
        <aside className={clsx(styles.sidebar, collapsed && styles.collapsed)}>
          <div className={styles.sidebarHeader}>
            <Brand compact={collapsed} />
          </div>
          <div className={styles.sidebarScroll}>
            <SideNav items={ADMIN_NAV} collapsed={collapsed} ariaLabel={navLabel} />
          </div>
          <div className={styles.sidebarFooter}>
            <IconButton
              label={collapsed ? t('nav:topbar.expandSidebar') : t('nav:topbar.collapseSidebar')}
              icon={collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              onClick={toggleCollapsed}
            />
          </div>
        </aside>
      )}
      {isNarrow && (
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={navLabel} side="left" width={280}>
          <SideNav items={ADMIN_NAV} ariaLabel={navLabel} onNavigate={() => setDrawerOpen(false)} />
        </Drawer>
      )}
      <div className={styles.main}>
        <header className={styles.topbar}>
          {isNarrow && (
            <>
              <IconButton label={t('nav:topbar.openMenu')} icon={<Menu />} onClick={() => setDrawerOpen(true)} />
              <Brand compact />
            </>
          )}
          <WorkspaceSwitcher current="admin" />
          <OrgSwitcher />
          <BranchSwitcher />
          <span className={styles.spacer} />
          <TimeClockButton />
          <LanguageSwitcher />
          <NotificationsBell />
          <UserMenu />
        </header>
        <main id="main-content" className={styles.content} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
