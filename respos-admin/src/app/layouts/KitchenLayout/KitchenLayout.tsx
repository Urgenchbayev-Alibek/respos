import { Maximize, Minimize } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { IconButton } from '@/shared/ui';
import { BranchSwitcher } from '@/widgets/topbar/BranchSwitcher';
import { ConnectionStatus } from '@/widgets/topbar/ConnectionStatus';
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
  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    const action = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    void action?.catch((error: unknown) => console.warn('[kds] fullscreen toggle failed', error));
  };

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
        <IconButton
          size="lg"
          label={fullscreen ? t('nav:kitchen.exitFullscreen') : t('nav:kitchen.fullscreen')}
          icon={fullscreen ? <Minimize /> : <Maximize />}
          onClick={toggleFullscreen}
        />
        <WorkspaceSwitcher current="kitchen" />
        <UserMenu />
      </header>
      <main id="main-content" className={styles.content} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
