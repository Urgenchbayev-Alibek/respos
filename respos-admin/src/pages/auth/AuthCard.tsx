import type { ReactNode } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { LanguageSwitcher } from '@/widgets/topbar/LanguageSwitcher';
import styles from './AuthCard.module.css';

export interface AuthCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/** Centered card shell for login / password / invitation screens. */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className={styles.page}>
      <div className={styles.language}>
        <LanguageSwitcher />
      </div>
      <main className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            <UtensilsCrossed />
          </span>
          RestaurantOS
        </div>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </main>
    </div>
  );
}
