import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '@/shared/config/routes';
import { ButtonLink } from '@/shared/ui/Button';
import { Container } from '@/shared/ui/Container';
import styles from './CtaBanner.module.css';

export function CtaBanner() {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section className={styles.wrap} aria-labelledby={titleId}>
      <Container>
        <div className={styles.banner}>
          <div>
            <h2 id={titleId} className={styles.title}>
              {t('home.cta.title')}
            </h2>
            <p className={styles.text}>{t('home.cta.text')}</p>
          </div>
          <ButtonLink to={ROUTES.demo} size="lg" variant="inverse" icon={<ArrowRight aria-hidden="true" />}>
            {t('actions.requestDemo')}
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
