import { UtensilsCrossed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resolvePhotoUrl, type PublicMenuItem } from '@/shared/api/publicMenuApi';
import { formatMoney } from '@/shared/lib/formatMoney';
import { localized } from './localized';
import styles from './PublicMenu.module.css';

/** NBSP + em dash + NBSP: a price never wraps away from its portion name. */
const PAIR_DASH = '\u00A0\u2014\u00A0';

export function MenuItemCard({ item, currency }: { item: PublicMenuItem; currency: string }) {
  const { t, i18n } = useTranslation();
  const photo = resolvePhotoUrl(item.photoUrl);
  const money = (amount: number) => formatMoney(amount, currency, i18n.language);
  const price =
    item.variants.length > 0
      ? t('qrMenu.fromPrice', { price: money(Math.min(...item.variants.map((variant) => variant.price))) })
      : money(item.price);

  return (
    <li className={styles.item}>
      {photo ? (
        <img className={styles.photo} src={photo} alt="" loading="lazy" width={96} height={96} />
      ) : (
        <span className={styles.photo} aria-hidden="true">
          <UtensilsCrossed size={28} />
        </span>
      )}
      <div className={styles.itemBody}>
        <h3 className={styles.itemName}>{localized(item, i18n.language)}</h3>
        {item.description && <p className={styles.description}>{item.description}</p>}
        {item.variants.length > 1 && (
          <p className={styles.variants}>
            {item.variants.map((variant) => [variant.name, money(variant.price)].join(PAIR_DASH)).join(' · ')}
          </p>
        )}
        <p className={styles.price}>{price}</p>
      </div>
    </li>
  );
}
