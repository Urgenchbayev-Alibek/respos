import { useTranslation } from 'react-i18next';
import { Section } from '@/shared/ui/Section';
import { DashboardMock } from '@/widgets/mockups/DashboardMock';
import { FloorMock } from '@/widgets/mockups/FloorMock';
import { KdsMock } from '@/widgets/mockups/KdsMock';
import styles from './HomeSections.module.css';

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
        {items.map((item) => (
          <div key={item.key} className={styles.showcaseItem}>
            {item.mock}
            <p className={styles.showcaseCaption}>{t(`home.showcase.${item.key}`)}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
