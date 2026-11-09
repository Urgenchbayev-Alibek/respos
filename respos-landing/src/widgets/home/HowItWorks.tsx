import { useTranslation } from 'react-i18next';
import { useTList } from '@/shared/i18n/useTList';
import { Section } from '@/shared/ui/Section';
import styles from './HomeSections.module.css';

interface Step {
  title: string;
  text: string;
}

export function HowItWorks() {
  const { t } = useTranslation();
  const steps = useTList<Step>('home.steps.items');

  return (
    <Section tone="muted" title={t('home.steps.title')} align="center">
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.stepNumber} aria-hidden="true">
              {index + 1}
            </span>
            <h3 className={styles.cardTitle}>{step.title}</h3>
            <p className={styles.cardText}>{step.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
