import { useTranslation } from 'react-i18next';
import { CircleCheck } from 'lucide-react';
import { useTList } from '@/shared/i18n/useTList';
import { usePageMeta } from '@/shared/lib/usePageMeta';
import { Container } from '@/shared/ui/Container';
import { Section } from '@/shared/ui/Section';
import { DemoForm } from '@/widgets/demo-form/DemoForm';
import styles from './Pages.module.css';

export function DemoPage() {
  const { t } = useTranslation();
  const next = useTList('demo.next');
  usePageMeta(t('meta.demo.title'), t('meta.demo.description'));
  return (
    <>
      <Section headingLevel="h1" title={t('demo.title')} lead={t('demo.lead')} />
      <Container className={styles.pageBody}>
        <div className={styles.demoLayout}>
          <div className={styles.formCard}>
            <DemoForm />
          </div>
          <aside className={styles.aside} aria-labelledby="demo-next-title">
            <h2 id="demo-next-title" className={styles.cardTitle}>
              {t('demo.nextTitle')}
            </h2>
            <ol className={styles.nextList}>
              {next.map((step) => (
                <li key={step}>
                  <CircleCheck aria-hidden="true" />
                  {step}
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </Container>
    </>
  );
}
