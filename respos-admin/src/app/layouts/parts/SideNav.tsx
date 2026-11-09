import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import type { NavItem } from '@/app/navigation/nav-types';
import styles from './SideNav.module.css';
import { useVisibleNav } from './use-visible-nav';

export interface SideNavProps {
  items: readonly NavItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
  ariaLabel: string;
}

export function SideNav({ items, collapsed = false, onNavigate, ariaLabel }: SideNavProps) {
  const { t } = useTranslation();
  const visible = useVisibleNav(items);
  return (
    <nav aria-label={ariaLabel} className={clsx(styles.nav, collapsed && styles.collapsed)}>
      <ul className={styles.list}>
        {visible.map((item) => {
          const Icon = item.icon;
          const label = t(item.labelKey);
          return (
            <li key={item.id}>
              <NavLink
                to={item.path}
                end={item.end}
                title={collapsed ? label : undefined}
                onClick={onNavigate}
                className={({ isActive }) => clsx(styles.link, isActive && styles.active)}
              >
                <Icon aria-hidden="true" className={styles.icon} />
                <span className={styles.label}>{label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
