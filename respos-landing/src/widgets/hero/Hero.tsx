import { useTranslation } from 'react-i18next';
import { ArrowRight, Check } from 'lucide-react';
import { ROUTES } from '@/shared/config/routes';
import { useTList } from '@/shared/i18n/useTList';
import { ButtonLink } from '@/shared/ui/Button';
import { Container } from '@/shared/ui/Container';
import { DashboardMock } from '@/widgets/mockups/DashboardMock';
import { KdsMock } from '@/widgets/mockups/KdsMock';
import styles from './Hero.module.css';

export function Hero() {
  const { t } = useTranslation();
  const points = useTList('home.hero.points');

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <Container className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{t('home.hero.eyebrow')}</p>
          <h1 id="hero-title" className={styles.title}>
            {t('home.hero.title')}
          </h1>
          <p className={styles.lead}>{t('home.hero.lead')}</p>
          <div className={styles.ctas}>
            <ButtonLink to={ROUTES.demo} size="lg" icon={<ArrowRight aria-hidden="true" />}>
              {t('actions.requestDemo')}
            </ButtonLink>
            <ButtonLink to={ROUTES.features} size="lg" variant="secondary">
              {t('actions.seeFeatures')}
            </ButtonLink>
          </div>
          <ul className={styles.points}>
            {points.map((point) => (
              <li key={point}>
                <Check aria-hidden="true" className={styles.check} />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.visual}>
          <DashboardMock className={styles.mainMock} />
          <KdsMock className={styles.floatMock} />
        </div>
      </Container>
    </section>
  );
}
