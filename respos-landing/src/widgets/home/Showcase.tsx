import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useReveal } from '@/shared/lib/useReveal';
import { Section } from '@/shared/ui/Section';
import { DashboardMock } from '@/widgets/mockups/DashboardMock';
import { FloorMock } from '@/widgets/mockups/FloorMock';
import { KdsMock } from '@/widgets/mockups/KdsMock';
import styles from './HomeSections.module.css';

function ShowcaseItem({ index, mock, caption }: { index: number; mock: ReactNode; caption: string }) {
  const ref = useReveal<HTMLDivElement>();

  return (
    <div ref={ref} className={styles.showcaseItem} style={{ '--i': index } as CSSProperties}>
      {mock}
      <p className={styles.showcaseCaption}>{caption}</p>
    </div>
  );
}

export function Showcase() {
  const { t } = useTranslation();
  const items = [
    { key: 'floor', mock: <FloorMock /> },
    { key: 'kds', mock: <KdsMock /> },
    { key: 'dashboard', mock: <DashboardMock /> },
  ];

  return (
    <Section title={t('home.showcase.title')} align="center">
      <div className={styles.showcase}>
        {items.map((item, index) => (
          <ShowcaseItem key={item.key} index={index} mock={item.mock} caption={t(`home.showcase.${item.key}`)} />
        ))}
      </div>
    </Section>
  );
}
