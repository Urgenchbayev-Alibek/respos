import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { BranchSwitcher } from '@/widgets/topbar/BranchSwitcher';
import { ConnectionStatus } from '@/widgets/topbar/ConnectionStatus';
import { FullscreenToggle } from '@/widgets/topbar/FullscreenToggle';
import { UserMenu } from '@/widgets/topbar/UserMenu';
import { Brand } from '../parts/Brand';
import { WorkspaceSwitcher } from '../parts/WorkspaceSwitcher';
import styles from './KitchenLayout.module.css';

const CLOCK_TICK_MS = 15_000;

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** KDS: fullscreen dark theme, huge type, big touch targets, always-visible connection state. */
export function KitchenLayout() {
  const { t } = useTranslation();
  const format = useFormatters();
  const now = useClock();

  return (
    <div className={styles.shell} data-theme="kds" data-workspace="kitchen">
      <header className={styles.header}>
        <Brand compact />
        <h1 className={styles.title}>{t('nav:workspaces.kitchen')}</h1>
        <BranchSwitcher />
        <span className={styles.spacer} />
        <ConnectionStatus />
        <time className={styles.clock} dateTime={now.toISOString()}>
          {format.time(now)}
        </time>
        <FullscreenToggle size="lg" />
        <WorkspaceSwitcher current="kitchen" />
        <UserMenu showTheme={false} />
      </header>
      <main id="main-content" className={styles.content} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
