import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from '@/widgets/footer/Footer';
import { Header } from '@/widgets/header/Header';
import styles from './Layout.module.css';

const MAIN_ID = 'main-content';

/** Scrolls to the top (or to the #hash target) on navigation. */
function useScrollOnNavigate() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
      return;
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);
}

export function Layout() {
  const { t } = useTranslation();
  useScrollOnNavigate();

  return (
    <div className={styles.shell}>
      <a href={`#${MAIN_ID}`} className={styles.skipLink}>
        {t('nav.skipToContent')}
      </a>
      <Header />
      <main id={MAIN_ID} className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
