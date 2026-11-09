import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '@/shared/config/routes';
import { Badge } from '@/shared/ui/Badge';
import { ButtonLink } from '@/shared/ui/Button';
import { Section } from '@/shared/ui/Section';
import { MODULES } from './moduleCatalog';
import styles from './ModulesGrid.module.css';

/** Compact overview of all modules (home page). */
export function ModulesGrid() {
  const { t } = useTranslation();
  return (
    <Section title={t('home.modules.title')} lead={t('home.modules.lead')}>
      <ul className={styles.grid}>
        {MODULES.map(({ id, icon: Icon }) => {
          const badge = t(`features.modules.${id}.badge`);
          return (
            <li key={id} className={styles.tile}>
              <span className={styles.icon}>
                <Icon aria-hidden="true" />
              </span>
              <h3 className={styles.title}>{t(`features.modules.${id}.title`)}</h3>
              <p className={styles.text}>{t(`features.modules.${id}.short`)}</p>
              {badge && (
                <Badge tone="warning" className={styles.badge}>
                  {t(`status.${badge}`)}
                </Badge>
              )}
            </li>
          );
        })}
      </ul>
      <div className={styles.more}>
        <ButtonLink to={ROUTES.features} variant="secondary" icon={<ArrowRight aria-hidden="true" />}>
          {t('actions.allFeatures')}
        </ButtonLink>
      </div>
    </Section>
  );
}
