import { useId, type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { Container } from './Container';
import styles from './Section.module.css';

interface SectionProps {
  title?: ReactNode;
  lead?: ReactNode;
  eyebrow?: ReactNode;
  tone?: 'plain' | 'muted';
  align?: 'start' | 'center';
  /** Use `h1` for the main heading of inner pages. */
  headingLevel?: 'h1' | 'h2';
  children?: ReactNode;
  className?: string;
}

export function Section({
  title,
  lead,
  eyebrow,
  tone = 'plain',
  align = 'start',
  headingLevel = 'h2',
  children,
  className,
}: SectionProps) {
  const headingId = useId();
  const Heading = headingLevel;
  return (
    <section
      className={cx(styles.section, tone === 'muted' && styles.muted, !children && styles.intro, className)}
      aria-labelledby={title ? headingId : undefined}
    >
      <Container>
        {(title || lead || eyebrow) && (
          <div className={cx(styles.header, align === 'center' && styles.center)}>
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            {title && (
              <Heading id={headingId} className={cx(styles.title, headingLevel === 'h1' && styles.pageTitle)}>
                {title}
              </Heading>
            )}
            {lead && <p className={styles.lead}>{lead}</p>}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}
