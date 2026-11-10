import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { PageHeader, Tabs, type TabItem } from '@/shared/ui';
import { CategoriesSection } from './CategoriesSection';
import { CountsSection } from './CountsSection';
import { IngredientsSection } from './IngredientsSection';
import { MovementsSection } from './MovementsSection';
import { TransfersSection } from './TransfersSection';
import { UnitsSection } from './UnitsSection';

const TABS = ['ingredients', 'movements', 'transfers', 'counts', 'units', 'categories'] as const;
type InventoryTab = (typeof TABS)[number];

const isTab = (value: string | null): value is InventoryTab => TABS.includes(value as InventoryTab);

/** Stock: balances, movements journal, counts, units, categories (`?tab=`). Used by /stock and /admin/inventory. */
export function InventoryPage() {
  const { t } = useTranslation('stock');
  const { hasPermission, hasAny } = usePermissions();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const visible = TABS.filter(
    (tab) =>
      (tab !== 'counts' || hasPermission(PERMISSIONS.inventory.adjust)) &&
      (tab !== 'transfers' || hasAny([PERMISSIONS.inventory.read, PERMISSIONS.inventory.transfer])),
  );
  const tab: InventoryTab = isTab(requested) && visible.includes(requested) ? requested : 'ingredients';
  const items: TabItem[] = visible.map((id) => ({ id, label: t(`tabs.${id}`) }));

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <Tabs
        ariaLabel={t('title')}
        items={items}
        value={tab}
        onChange={(next) => setParams(next === 'ingredients' ? {} : { tab: next }, { replace: true })}
      />
      <div role="tabpanel" aria-label={t(`tabs.${tab}`)}>
        {tab === 'ingredients' && <IngredientsSection />}
        {tab === 'movements' && <MovementsSection />}
        {tab === 'transfers' && <TransfersSection />}
        {tab === 'counts' && <CountsSection />}
        {tab === 'units' && <UnitsSection />}
        {tab === 'categories' && <CategoriesSection />}
      </div>
    </>
  );
}

/** `/stock/counts` — counts as a standalone screen of the Stock workspace. */
export function StockCountsPage() {
  const { t } = useTranslation('stock');
  return (
    <>
      <PageHeader title={t('tabs.counts')} description={t('counts.description')} />
      <CountsSection />
    </>
  );
}
