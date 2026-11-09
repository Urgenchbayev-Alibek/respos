import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Info } from 'lucide-react';
import { useTList } from '@/shared/i18n/useTList';
import { cx } from '@/shared/lib/cx';
import { Badge } from '@/shared/ui/Badge';
import { Container } from '@/shared/ui/Container';
import { DashboardMock } from '@/widgets/mockups/DashboardMock';
import { FloorMock } from '@/widgets/mockups/FloorMock';
import { KdsMock } from '@/widgets/mockups/KdsMock';
import { MODULES } from '@/widgets/modules/moduleCatalog';
import styles from './FeatureList.module.css';

/** Modules shown as large rows with an illustration. */
const ILLUSTRATED: Record<string, ReactNode> = {
  tables: <FloorMock />,
  kds: <KdsMock />,
  reports: <DashboardMock />,
};

function FeatureCard({ id, wide }: { id: string; wide: boolean }) {
  const { t } = useTranslation();
  const points = useTList(`features.modules.${id}.points`);
  const badge = t(`features.modules.${id}.badge`);
  const module = MODULES.find((m) => m.id === id);
  const Icon = module?.icon;

  return (
    <article id={id} className={cx(styles.card, wide && styles.wide)} aria-labelledby={`${id}-title`}>
      <div className={styles.body}>
        <div className={styles.head}>
          {Icon && (
            <span className={styles.icon}>
              <Icon aria-hidden="true" />
            </span>
          )}
          <h2 id={`${id}-title`} className={styles.title}>
            {t(`features.modules.${id}.title`)}
          </h2>
          {badge && <Badge tone="warning">{t(`status.${badge}`)}</Badge>}
        </div>
        <p className={styles.short}>{t(`features.modules.${id}.short`)}</p>
        <ul className={styles.points}>
          {points.map((point) => (
            <li key={point}>
              <Check aria-hidden="true" className={styles.check} />
              {point}
            </li>
          ))}
        </ul>
      </div>
      {wide && <div className={styles.visual}>{ILLUSTRATED[id]}</div>}
    </article>
  );
}

export function FeatureList() {
  const { t } = useTranslation();
  return (
    <Container>
      <p className={styles.note}>
        <Info aria-hidden="true" />
        {t('features.plannedNote')}
      </p>
      <div className={styles.grid}>
        {MODULES.map(({ id }) => (
          <FeatureCard key={id} id={id} wide={id in ILLUSTRATED} />
        ))}
      </div>
    </Container>
  );
}
