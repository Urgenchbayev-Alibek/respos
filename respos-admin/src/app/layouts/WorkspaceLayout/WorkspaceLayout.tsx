import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';
import type { NavItem } from '@/app/navigation/nav-types';
import type { WorkspaceId } from '@/app/navigation/workspaces';
import { ShortcutsOverlay } from '@/widgets/shortcuts/ShortcutsOverlay';
import { BranchSwitcher } from '@/widgets/topbar/BranchSwitcher';
import { ConnectionStatus } from '@/widgets/topbar/ConnectionStatus';
import { LanguageSwitcher } from '@/widgets/topbar/LanguageSwitcher';
import { UserMenu } from '@/widgets/topbar/UserMenu';
import { Brand } from '../parts/Brand';
import { SkipLink } from '../parts/SkipLink';
import { useVisibleNav } from '../parts/use-visible-nav';
import { WorkspaceSwitcher } from '../parts/WorkspaceSwitcher';
import styles from './WorkspaceLayout.module.css';

export interface WorkspaceLayoutProps {
  /** Sets density (`data-workspace`): waiter/cashier/stock get 16px base + 44px touch targets. */
  workspace?: WorkspaceId;
  nav?: readonly NavItem[];
  /** Show branch switcher (not for platform/account). */
  showBranch?: boolean;
  showConnection?: boolean;
  /** Extra topbar content (right side, before language). */
  topbarExtra?: ReactNode;
}

/**
 * Tablet-first operational shell: top bar with tabs on wide screens, bottom navigation on phones.
 * Used by Waiter, Cashier, Stock, Platform and account pages.
 */
export function WorkspaceLayout({ workspace, nav = [], showBranch = true, showConnection = false, topbarExtra }: WorkspaceLayoutProps) {
  const { t } = useTranslation();
  const items = useVisibleNav(nav);
  const navLabel = t('nav:sectionNav');

  const renderLinks = (variant: 'tabs' | 'bottom') =>
    items.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.id}
          to={item.path}
          end={item.end}
          className={({ isActive }) => clsx(styles[variant === 'tabs' ? 'tab' : 'bottomLink'], isActive && styles.active)}
        >
          <Icon aria-hidden="true" />
          <span>{t(item.labelKey)}</span>
        </NavLink>
      );
    });

  return (
    <div className={clsx(styles.shell, items.length > 0 && styles.withBottomNav)} data-workspace={workspace}>
      <SkipLink />
      <header className={styles.topbar}>
        <Brand compact />
        <WorkspaceSwitcher current={workspace} />
        {showBranch && <BranchSwitcher />}
        {items.length > 0 && (
          <nav aria-label={navLabel} className={styles.tabs}>
            {renderLinks('tabs')}
          </nav>
        )}
        <span className={styles.spacer} />
        {showConnection && <ConnectionStatus />}
        {topbarExtra}
        <ShortcutsOverlay />
        <LanguageSwitcher />
        <UserMenu />
      </header>
      <main id="main-content" className={styles.content} tabIndex={-1}>
        <Outlet />
      </main>
      {items.length > 0 && (
        <nav aria-label={navLabel} className={styles.bottomNav}>
          {renderLinks('bottom')}
        </nav>
      )}
    </div>
  );
}
