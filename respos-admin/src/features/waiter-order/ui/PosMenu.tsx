import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizedName, type MenuItemDto, type PosCategoryDto } from '@/entities/menu/menu.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { EmptyState, SearchInput } from '@/shared/ui';
import styles from './PosMenu.module.css';

export interface PosMenuProps {
  categories: PosCategoryDto[];
  onPick: (item: MenuItemDto) => void;
}

/** Waiter menu: category tabs, search across all categories, big item tiles (tap = add). */
export function PosMenu({ categories, onPick }: PosMenuProps) {
  const { t, i18n } = useTranslation('waiter');
  const format = useFormatters();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const activeId = categoryId ?? categories[0]?.id ?? null;
  const query = search.trim().toLocaleLowerCase();

  const items = useMemo(() => {
    if (query) {
      return categories
        .flatMap((category) => category.items)
        .filter((item) => [item.name, item.nameUz ?? ''].some((value) => value.toLocaleLowerCase().includes(query)));
    }
    return categories.find((category) => category.id === activeId)?.items ?? [];
  }, [categories, activeId, query]);

  const priceLabel = (item: MenuItemDto) => {
    if (item.variants.length === 0) return format.money(item.price);
    const min = Math.min(...item.variants.map((variant) => variant.price));
    return t('menu.fromPrice', { price: format.money(min) });
  };

  return (
    <section className={styles.menu} aria-label={t('menu.title')}>
      <div className={styles.search}>
        <SearchInput value={search} onChange={setSearch} placeholder={t('menu.search')} data-shortcut="menu-search" />
      </div>
      {!query && (
        <div className={styles.categories} role="group" aria-label={t('menu.categories')}>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={clsx(styles.category, category.id === activeId && styles.activeCategory)}
              aria-pressed={category.id === activeId}
              onClick={() => setCategoryId(category.id)}
            >
              {localizedName(category, i18n.language)}
            </button>
          ))}
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState compact title={query ? t('menu.notFound') : t('menu.emptyCategory')} />
      ) : (
        <ul className={styles.items}>
          {items.map((item) => {
            const unavailable = !item.isAvailable || item.isArchived;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={clsx(styles.item, unavailable && styles.unavailable)}
                  disabled={unavailable}
                  onClick={() => onPick(item)}
                >
                  <span className={styles.name}>{localizedName(item, i18n.language)}</span>
                  {unavailable ? (
                    <span className={styles.tag}>{t('menu.unavailable')}</span>
                  ) : (
                    <span className={styles.price}>{priceLabel(item)}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
