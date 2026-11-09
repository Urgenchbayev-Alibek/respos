import { useTranslation } from 'react-i18next';
import type { DiningAreaDto } from '@/entities/dining-area/dining-area.types';
import { Tabs } from '@/shared/ui';

export const ALL_AREAS = 'all';

export interface AreaFilterProps {
  areas: DiningAreaDto[];
  value: string;
  onChange: (areaId: string) => void;
}

/** Area tabs with "All areas" first. Hidden when there is at most one area. */
export function AreaFilter({ areas, value, onChange }: AreaFilterProps) {
  const { t } = useTranslation('floor');
  if (areas.length <= 1) return null;
  return (
    <Tabs
      ariaLabel={t('areaFilter')}
      value={value}
      onChange={onChange}
      items={[{ id: ALL_AREAS, label: t('allAreas') }, ...areas.map((area) => ({ id: area.id, label: area.name }))]}
    />
  );
}
