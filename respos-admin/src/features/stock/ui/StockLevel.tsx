import { useTranslation } from 'react-i18next';
import type { IngredientDto } from '@/entities/ingredient/ingredient.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { StatusBadge } from '@/shared/ui';
import styles from './stock.module.css';
import { formatUnit } from '@/shared/lib/format-unit';

type Level = Pick<IngredientDto, 'quantity' | 'isLow' | 'isArchived' | 'baseUnitCode'>;

/** Balance with low/negative highlight (isLow comes from the server). */
export function QuantityCell({ ingredient }: { ingredient: Level }) {
  const format = useFormatters();
  const className = ingredient.quantity < 0 ? styles.negative : ingredient.isLow ? styles.low : styles.num;
  return (
    <span className={className}>
      {format.number(ingredient.quantity)} {formatUnit(ingredient.baseUnitCode)}
    </span>
  );
}

export function IngredientStockBadge({ ingredient }: { ingredient: Level }) {
  const { t } = useTranslation('stock');
  if (ingredient.isArchived) return <StatusBadge tone="neutral">{t('level.archived')}</StatusBadge>;
  if (ingredient.quantity < 0) return <StatusBadge tone="danger">{t('level.negative')}</StatusBadge>;
  if (ingredient.isLow) return <StatusBadge tone="warning">{t('level.low')}</StatusBadge>;
  return <StatusBadge tone="success">{t('level.ok')}</StatusBadge>;
}
