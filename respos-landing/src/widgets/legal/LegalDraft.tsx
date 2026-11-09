import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { useTList } from '@/shared/i18n/useTList';
import { Badge } from '@/shared/ui/Badge';
import { Container } from '@/shared/ui/Container';
import styles from './LegalDraft.module.css';

interface LegalDraftProps {
  doc: 'privacy' | 'terms';
}

/** Placeholder structure of a legal document; real text requires legal review. */
export function LegalDraft({ doc }: LegalDraftProps) {
  const { t } = useTranslation();
  const sections = useTList(`legal.${doc}.sections`);

  return (
    <Container narrow className={styles.wrap}>
      <Badge tone="warning">
        <TriangleAlert aria-hidden="true" />
        {t('legal.draftBadge')}
      </Badge>
      <h1 className={styles.title}>{t(`legal.${doc}.title`)}</h1>
      <p className={styles.note} role="note">
        {t('legal.draftNote')}
      </p>
      <ol className={styles.sections}>
        {sections.map((title) => (
          <li key={title} className={styles.section}>
            <h2 className={styles.sectionTitle}>{title}</h2>
            <p className={styles.placeholder}>{t('legal.placeholder')}</p>
          </li>
        ))}
      </ol>
    </Container>
  );
}
