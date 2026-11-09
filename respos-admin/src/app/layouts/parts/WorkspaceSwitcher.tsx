import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { availableWorkspaces, getWorkspace, type WorkspaceId } from '@/app/navigation/workspaces';
import { useAuth } from '@/shared/hooks/use-auth';
import { DropdownMenu } from '@/shared/ui';
import styles from '@/widgets/topbar/TopbarTrigger.module.css';

/** Switch between Admin / Waiter / KDS / Cashier / Stock / Platform (only those the user can access). */
export function WorkspaceSwitcher({ current }: { current?: WorkspaceId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const workspaces = availableWorkspaces(user);
  if (workspaces.length <= 1 && current) return null;
  const active = current ? getWorkspace(current) : null;
  const ActiveIcon = active?.icon;

  return (
    <DropdownMenu
      align="start"
      header={t('nav:topbar.workspace')}
      items={workspaces.map((workspace) => {
        const Icon = workspace.icon;
        return {
          id: workspace.id,
          label: t(workspace.labelKey),
          icon: <Icon />,
          selected: workspace.id === current,
          onSelect: () => navigate(workspace.path),
        };
      })}
      trigger={(props) => (
        <button type="button" className={styles.trigger} aria-label={t('nav:topbar.switchWorkspace')} {...props}>
          {ActiveIcon && <ActiveIcon aria-hidden="true" />}
          <span className={`${styles.label} ${styles.hideOnMobile}`}>
            {active ? t(active.labelKey) : t('nav:topbar.workspace')}
          </span>
          <ChevronDown aria-hidden="true" />
        </button>
      )}
    />
  );
}
