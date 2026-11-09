import clsx from 'clsx';
import { UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/shared/constants/routes';
import styles from './Brand.module.css';

/** Logo + product name, links to the default workspace. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to={ROUTES.home} className={clsx(styles.brand, compact && styles.compact)} aria-label="RestaurantOS">
      <span className={styles.logo} aria-hidden="true">
        <UtensilsCrossed />
      </span>
      {!compact && <span className={styles.name}>RestaurantOS</span>}
    </Link>
  );
}
