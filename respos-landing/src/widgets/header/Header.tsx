import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LogIn, Menu, X } from 'lucide-react';
import { env } from '@/shared/config/env';
import { NAV_ITEMS, ROUTES } from '@/shared/config/routes';
import { cx } from '@/shared/lib/cx';
import { ButtonAnchor, ButtonLink } from '@/shared/ui/Button';
import { Container } from '@/shared/ui/Container';
import { Logo } from '@/shared/ui/Logo';
import { LanguageSwitch } from './LanguageSwitch';
import styles from './Header.module.css';

const MOBILE_MENU_ID = 'mobile-menu';

export function Header() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  // The menu remembers the path it was opened on, so navigating closes it automatically.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const close = () => setOpenedAt(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenedAt(null);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const navLinks = NAV_ITEMS.map((item) => (
    <li key={item.to}>
      <NavLink to={item.to} onClick={close} className={({ isActive }) => cx(styles.navLink, isActive && styles.navActive)}>
        {t(`nav.${item.key}`)}
      </NavLink>
    </li>
  ));

  return (
    <header className={styles.header}>
      <Container className={styles.bar}>
        <Link to={ROUTES.home} className={styles.brand} aria-label={`${t('brand')} — ${t('nav.home')}`}>
          <Logo />
        </Link>

        <nav className={styles.desktopNav} aria-label={t('nav.primary')}>
          <ul className={styles.navList}>{navLinks}</ul>
        </nav>

        <div className={styles.actions}>
          <LanguageSwitch className={styles.desktopOnly} />
          <ButtonAnchor href={env.adminAppUrl} variant="ghost" className={styles.desktopOnly}>
            {t('nav.login')}
          </ButtonAnchor>
          <ButtonLink to={ROUTES.demo} className={styles.demoButton}>
            {t('nav.demo')}
          </ButtonLink>
          <button
            type="button"
            className={styles.burger}
            aria-expanded={open}
            aria-controls={MOBILE_MENU_ID}
            aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
            onClick={() => setOpenedAt(open ? null : pathname)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </Container>

      <div id={MOBILE_MENU_ID} className={styles.mobilePanel} hidden={!open}>
        <Container>
          <nav aria-label={t('nav.primary')}>
            <ul className={styles.mobileList}>{navLinks}</ul>
          </nav>
          <div className={styles.mobileActions}>
            <LanguageSwitch />
            <ButtonAnchor href={env.adminAppUrl} variant="secondary" icon={<LogIn aria-hidden="true" />}>
              {t('nav.login')}
            </ButtonAnchor>
            <ButtonLink to={ROUTES.demo} block>
              {t('nav.demo')}
            </ButtonLink>
          </div>
        </Container>
      </div>
    </header>
  );
}
