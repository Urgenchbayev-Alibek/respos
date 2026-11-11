import clsx from 'clsx';
import { ChevronDown, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { DropdownMenu } from '@/shared/ui';
import styles from './TopbarTrigger.module.css';

/** Current branch selector (drives X-Branch-Id). Static label when the user has one branch. */
export function BranchSwitcher() {
  const { t } = useTranslation();
  const { branch, branches, setBranch } = useCurrentBranch();
  if (!branch) return null;

  if (branches.length <= 1) {
    return (
      <span className={clsx(styles.trigger, styles.static, styles.absorb)} title={t('nav:topbar.branch')}>
        <Store aria-hidden="true" />
        <span className={styles.label}>{branch.name}</span>
      </span>
    );
  }

  return (
    <DropdownMenu
      align="start"
      header={t('nav:topbar.branch')}
      items={branches.map((item) => ({
        id: item.id,
        label: item.name,
        selected: item.id === branch.id,
        onSelect: () => setBranch(item.id),
      }))}
      trigger={(props) => (
        <button type="button" className={clsx(styles.trigger, styles.absorb)} aria-label={t('nav:topbar.switchBranch')} {...props}>
          <Store aria-hidden="true" />
          <span className={styles.label}>{branch.name}</span>
          <ChevronDown aria-hidden="true" />
        </button>
      )}
    />
  );
}
