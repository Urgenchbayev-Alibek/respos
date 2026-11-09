import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/shared/config/routes';
import { usePageMeta } from '@/shared/lib/usePageMeta';
import { ButtonLink } from '@/shared/ui/Button';
import { Container } from '@/shared/ui/Container';
import { Section } from '@/shared/ui/Section';
import { FaqList } from '@/widgets/faq/FaqList';
import styles from './Pages.module.css';

export function FaqPage() {
  const { t } = useTranslation();
  usePageMeta(t('meta.faq.title'), t('meta.faq.description'));
  return (
    <>
      <Section headingLevel="h1" title={t('faq.title')} lead={t('faq.lead')} />
      <Container narrow className={styles.pageBody}>
        <FaqList />
        <div className={styles.moreBox}>
          <p className={styles.moreTitle}>{t('faq.more')}</p>
          <ButtonLink to={ROUTES.demo}>{t('actions.contactUs')}</ButtonLink>
        </div>
      </Container>
    </>
  );
}
