import { useTranslation } from 'react-i18next';
import { Clock, MapPin, MessageCircle, Send, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@/shared/config/routes';
import { usePageMeta } from '@/shared/lib/usePageMeta';
import { Badge } from '@/shared/ui/Badge';
import { ButtonLink } from '@/shared/ui/Button';
import { Container } from '@/shared/ui/Container';
import { Section } from '@/shared/ui/Section';
import styles from './Pages.module.css';

const INFO: { id: 'channels' | 'hours' | 'city'; icon: LucideIcon }[] = [
  { id: 'channels', icon: MessageCircle },
  { id: 'hours', icon: Clock },
  { id: 'city', icon: MapPin },
];

export function ContactsPage() {
  const { t } = useTranslation();
  usePageMeta(t('meta.contacts.title'), t('meta.contacts.description'));
  return (
    <>
      <Section headingLevel="h1" title={t('contacts.title')} lead={t('contacts.lead')} />
      <Container className={styles.pageBody}>
        <div className={styles.contactsGrid}>
          <div className={styles.contactPrimary}>
            <h2 className={styles.cardTitle}>{t('contacts.formTitle')}</h2>
            <p>{t('contacts.formText')}</p>
            <ButtonLink to={ROUTES.demo} variant="inverse" icon={<Send aria-hidden="true" />}>
              {t('actions.requestDemo')}
            </ButtonLink>
          </div>
          {INFO.map(({ id, icon: Icon }) => (
            <div key={id} className={styles.contactCard}>
              <Icon aria-hidden="true" className={styles.contactIcon} />
              <h2 className={styles.cardTitle}>{t(`contacts.${id}Title`)}</h2>
              <p className={styles.muted}>{t(`contacts.${id}Text`)}</p>
              {id === 'channels' && <Badge tone="warning">{t('status.planned')}</Badge>}
            </div>
          ))}
        </div>
      </Container>
    </>
  );
}
