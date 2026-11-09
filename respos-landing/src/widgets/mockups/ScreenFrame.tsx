import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '@/shared/lib/cx';
import styles from './Mockups.module.css';

interface ScreenFrameProps {
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * Browser-like frame around a product illustration.
 * Exposed to assistive tech as one image with a descriptive label.
 */
export function ScreenFrame({ title, children, className }: ScreenFrameProps) {
  const { t } = useTranslation();
  return (
    <figure className={cx(styles.frame, className)} role="img" aria-label={`${title}. ${t('mock.caption')}`}>
      <div className={styles.chrome} aria-hidden="true">
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.chromeTitle}>{title}</span>
      </div>
      <div className={styles.screen} aria-hidden="true">
        {children}
      </div>
    </figure>
  );
}
