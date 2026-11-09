import clsx from 'clsx';
import { History } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRecipeMenuItems, useRecipes } from '@/entities/recipe/recipe.queries';
import { RecipeEditor } from '@/features/recipes/ui/RecipeEditor';
import { RecipeHistoryDrawer } from '@/features/recipes/ui/RecipeHistoryDrawer';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Button, Card, EmptyState, ErrorState, PageHeader, PageLoader, SearchInput, Select, Skeleton } from '@/shared/ui';
import styles from './RecipesPage.module.css';

/** Pick a menu item (and variant) → edit its recipe; each save is a new version. */
export function RecipesPage() {
  const { t } = useTranslation('recipes');
  const format = useFormatters();
  const [search, setSearch] = useState('');
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const debounced = useDebouncedValue(search.trim());
  const items = useRecipeMenuItems(debounced);
  const recipes = useRecipes(menuItemId);
  const menuItems = (items.data?.items ?? []).filter((item) => !item.isArchived);
  const selected = menuItems.find((item) => item.id === menuItemId) ?? null;
  const activeRecipe = recipes.data?.find((recipe) => (recipe.variantId ?? null) === variantId && recipe.isActive) ?? null;

  const select = (id: string) => {
    setMenuItemId(id);
    setVariantId(null);
  };

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <div className={styles.layout}>
        <Card title={t('menuItems')} className={styles.list}>
          <SearchInput value={search} onChange={setSearch} placeholder={t('searchItems')} />
          {items.isLoading && <Skeleton height={120} />}
          {items.error && <ErrorState compact error={items.error} onRetry={() => void items.refetch()} />}
          {items.data && menuItems.length === 0 && <EmptyState compact title={t('noItems')} />}
          <ul className={styles.items} aria-label={t('menuItems')}>
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={clsx(styles.item, item.id === menuItemId && styles.selected)}
                  aria-pressed={item.id === menuItemId}
                  onClick={() => select(item.id)}
                >
                  <span>{item.name}</span>
                  {item.categoryName && <small>{item.categoryName}</small>}
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card
          className={styles.editor}
          title={
            selected
              ? activeRecipe
                ? t('versionTitle', { name: selected.name, version: activeRecipe.version, date: format.date(activeRecipe.effectiveFrom) })
                : selected.name
              : t('pickItem')
          }
          actions={
            selected && (
              <Button variant="ghost" icon={<History />} onClick={() => setHistoryOpen(true)}>
                {t('history')}
              </Button>
            )
          }
        >
          {!selected && <EmptyState title={t('pickItem')} description={t('pickItemHint')} />}
          {selected && selected.variants.length > 0 && (
            <Select
              aria-label={t('variant')}
              placeholder={t('baseItem')}
              value={variantId ?? ''}
              onChange={(event) => setVariantId(event.target.value || null)}
              options={selected.variants.map((variant) => ({ value: variant.id, label: variant.name }))}
            />
          )}
          {selected && recipes.isLoading && <PageLoader />}
          {selected && recipes.error && <ErrorState error={recipes.error} onRetry={() => void recipes.refetch()} />}
          {selected && recipes.data && (
            <RecipeEditor menuItemId={selected.id} variantId={variantId} recipe={activeRecipe} />
          )}
        </Card>
      </div>
      {selected && (
        <RecipeHistoryDrawer open={historyOpen} menuItemId={selected.id} variantId={variantId} onClose={() => setHistoryOpen(false)} />
      )}
    </>
  );
}
