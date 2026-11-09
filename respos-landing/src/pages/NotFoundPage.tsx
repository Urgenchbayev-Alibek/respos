import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/shared/config/routes';
import { usePageMeta } from '@/shared/lib/usePageMeta';
import { ButtonLink } from '@/shared/ui/Button';
import { Section } from '@/shared/ui/Section';

export function NotFoundPage() {
  const { t } = useTranslation();
  usePageMeta(t('meta.notFound.title'), t('meta.notFound.description'));
  return (
    <Section headingLevel="h1" align="center" eyebrow="404" title={t('notFound.title')} lead={t('notFound.text')}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <ButtonLink to={ROUTES.home}>{t('actions.backHome')}</ButtonLink>
      </div>
    </Section>
  );
}
