import { useTranslation } from 'react-i18next';
import { Briefcase, ChefHat, Crown, UserRound, type LucideIcon } from 'lucide-react';
import { Section } from '@/shared/ui/Section';
import styles from './HomeSections.module.css';

const ROLES: { id: string; icon: LucideIcon }[] = [
  { id: 'owner', icon: Crown },
  { id: 'manager', icon: Briefcase },
  { id: 'waiter', icon: UserRound },
  { id: 'kitchen', icon: ChefHat },
];

export function RolesSection() {
  const { t } = useTranslation();
  return (
    <Section tone="muted" title={t('home.roles.title')} lead={t('home.roles.lead')}>
      <ul className={styles.roles}>
        {ROLES.map(({ id, icon: Icon }) => (
          <li key={id} className={styles.roleCard}>
            <span className={styles.roleIcon}>
              <Icon aria-hidden="true" />
            </span>
            <h3 className={styles.cardTitle}>{t(`home.roles.items.${id}.title`)}</h3>
            <p className={styles.cardText}>{t(`home.roles.items.${id}.text`)}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
