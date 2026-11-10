import { Cake, Crown, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { StatusBadge } from '@/shared/ui';
import styles from './CustomerBadges.module.css';

interface CustomerBadgesProps {
  isVip: boolean;
  isBirthdayToday: boolean;
  isBirthdaySoon?: boolean;
  points?: number;
}

/** Birthday / VIP / points badges for guest rows, the guest card and waiter/cashier screens. */
export function CustomerBadges({ isVip, isBirthdayToday, isBirthdaySoon = false, points }: CustomerBadgesProps) {
  const { t } = useTranslation('customers');
  const format = useFormatters();
  return (
    <span className={styles.badges}>
      {isVip && (
        <StatusBadge tone="primary">
          <Crown aria-hidden="true" className={styles.icon} /> {t('badges.vip')}
        </StatusBadge>
      )}
      {isBirthdayToday ? (
        <StatusBadge tone="warning">
          <Cake aria-hidden="true" className={styles.icon} /> {t('badges.birthdayToday')}
        </StatusBadge>
      ) : (
        isBirthdaySoon && (
          <StatusBadge tone="info">
            <Cake aria-hidden="true" className={styles.icon} /> {t('badges.birthdaySoon')}
          </StatusBadge>
        )
      )}
      {points !== undefined && points > 0 && (
        <StatusBadge tone="success">
          <Star aria-hidden="true" className={styles.icon} /> {t('badges.points', { points: format.number(points, 0) })}
        </StatusBadge>
      )}
    </span>
  );
}
