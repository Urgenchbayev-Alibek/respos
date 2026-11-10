import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { qrSvg } from '../model/qr';
import styles from './QrSheet.module.css';

export interface TableQrCardProps {
  url: string;
  tableNumber: string;
  restaurantName: string;
}

/** One printable card: restaurant name, QR (SVG), table number, call-to-action. */
export function TableQrCard({ url, tableNumber, restaurantName }: TableQrCardProps) {
  const { t } = useTranslation('qrMenu');
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void qrSvg(url).then((markup) => {
      if (active) setSvg(markup);
    });
    return () => {
      active = false;
    };
  }, [url]);

  return (
    <figure className={styles.card} data-testid="table-qr-card">
      <figcaption className={styles.restaurant}>{restaurantName}</figcaption>
      {svg ? (
        // Generated locally by the pinned `qrcode` library from our own URL — not user HTML.
        <div className={styles.qr} role="img" aria-label={t('sheet.qrLabel', { number: tableNumber })} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className={styles.qr} aria-hidden="true" />
      )}
      <p className={styles.table}>{t('sheet.table', { number: tableNumber })}</p>
      <p className={styles.hint}>{t('sheet.scan')}</p>
    </figure>
  );
}
