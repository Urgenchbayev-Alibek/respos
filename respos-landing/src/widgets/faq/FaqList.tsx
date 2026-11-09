import { ChevronDown } from 'lucide-react';
import { useTList } from '@/shared/i18n/useTList';
import styles from './FaqList.module.css';

interface FaqItem {
  q: string;
  a: string;
}

/** Accordion built on native <details> — keyboard and screen-reader friendly by default. */
export function FaqList() {
  const items = useTList<FaqItem>('faq.items');
  return (
    <div className={styles.list}>
      {items.map((item) => (
        <details key={item.q} className={styles.item}>
          <summary className={styles.question}>
            <span>{item.q}</span>
            <ChevronDown aria-hidden="true" className={styles.chevron} />
          </summary>
          <p className={styles.answer}>{item.a}</p>
        </details>
      ))}
    </div>
  );
}
