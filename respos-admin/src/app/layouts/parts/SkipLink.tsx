import { useTranslation } from 'react-i18next';
import styles from './SkipLink.module.css';

/** Keyboard users jump straight to the page content (target: `#main-content`). */
export function SkipLink() {
  const { t } = useTranslation();
  return (
    <a href="#main-content" className={styles.skip}>
      {t('nav:skipToContent')}
    </a>
  );
}
