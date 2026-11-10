import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { ROUTES } from '@/shared/config/routes';
import { usePageMeta } from '@/shared/lib/usePageMeta';
import { Badge } from '@/shared/ui/Badge';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { LanguageSwitch } from '@/widgets/header/LanguageSwitch';
import { CallWaiterBar } from '@/widgets/public-menu/CallWaiterBar';
import { localized } from '@/widgets/public-menu/localized';
import { MenuItemCard } from '@/widgets/public-menu/MenuItemCard';
import styles from '@/widgets/public-menu/PublicMenu.module.css';
import { usePublicMenu } from '@/widgets/public-menu/usePublicMenu';

/** Public, mobile-first QR menu of a branch: `/menu/:branchSlug?table=N`. */
export function PublicMenuPage() {
  const { t, i18n } = useTranslation();
  const { branchSlug = '' } = useParams();
  const [params] = useSearchParams();
  const tableNumber = params.get('table')?.trim().slice(0, 20) || null;
  const { state, retry } = usePublicMenu(branchSlug);
  const [search, setSearch] = useState('');
  const menu = state.status === 'ready' ? state.menu : null;
  usePageMeta(menu ? `${menu.organizationName} — ${t('qrMenu.title')}` : t('qrMenu.title'), t('qrMenu.metaDescription'));

  const query = search.trim().toLocaleLowerCase();
  const categories = useMemo(() => {
    if (!menu) return [];
    if (!query) return menu.categories;
    return menu.categories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) =>
          [item.name, item.nameUz ?? '', item.description ?? ''].some((value) => value.toLocaleLowerCase().includes(query)),
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [menu, query]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.org}>{menu?.organizationName ?? t('qrMenu.title')}</p>
          {menu && <p className={styles.branch}>{menu.branch.name}</p>}
        </div>
        <div className={styles.headerSide}>
          {tableNumber && <Badge>{t('qrMenu.table', { number: tableNumber })}</Badge>}
          {menu?.isDemo && <Badge tone="warning">{t('qrMenu.demo')}</Badge>}
          <LanguageSwitch />
        </div>
      </header>

      <main className={styles.main} id="main">
        {state.status === 'loading' && <p className={styles.state} role="status">{t('qrMenu.loading')}</p>}
        {state.status === 'not-found' && (
          <section className={styles.state}>
            <h1>{t('qrMenu.notFound.title')}</h1>
            <p>{t('qrMenu.notFound.text')}</p>
            <ButtonLink to={ROUTES.home} variant="secondary">{t('actions.backHome')}</ButtonLink>
          </section>
        )}
        {state.status === 'error' && (
          <section className={styles.state}>
            <h1>{t('qrMenu.error.title')}</h1>
            <p>{t('qrMenu.error.text')}</p>
            <Button onClick={retry}>{t('qrMenu.error.retry')}</Button>
          </section>
        )}
        {menu && (
          <>
            <h1 className="visually-hidden">{t('qrMenu.title')}</h1>
            <label className={styles.search}>
              <Search size={18} aria-hidden="true" />
              <input type="search" value={search} placeholder={t('qrMenu.search')} aria-label={t('qrMenu.search')} onChange={(event) => setSearch(event.target.value)} />
            </label>
            {!query && menu.categories.length > 1 && (
              <nav className={styles.chips} aria-label={t('qrMenu.categories')}>
                {menu.categories.map((category) => (
                  <a key={category.id} href={`#cat-${category.id}`} className={styles.chip}>
                    {localized(category, i18n.language)}
                  </a>
                ))}
              </nav>
            )}
            {categories.length === 0 && <p className={styles.state}>{query ? t('qrMenu.nothingFound') : t('qrMenu.empty')}</p>}
            {categories.map((category) => (
              <section key={category.id} id={`cat-${category.id}`} className={styles.category} aria-labelledby={`cat-h-${category.id}`}>
                <h2 id={`cat-h-${category.id}`} className={styles.categoryTitle}>{localized(category, i18n.language)}</h2>
                <ul className={styles.items}>
                  {category.items.map((item) => (
                    <MenuItemCard key={item.id} item={item} currency={menu.currency} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </main>
      {menu && tableNumber && <CallWaiterBar slug={menu.branch.slug} tableNumber={tableNumber} />}
    </div>
  );
}
