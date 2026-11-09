import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/shared/config/routes';
import { Container } from '@/shared/ui/Container';
import { Logo } from '@/shared/ui/Logo';
import styles from './Footer.module.css';

interface FooterColumn {
  titleKey: string;
  links: { to: string; labelKey: string }[];
}

const COLUMNS: FooterColumn[] = [
  {
    titleKey: 'footer.product',
    links: [
      { to: ROUTES.features, labelKey: 'nav.features' },
      { to: ROUTES.pricing, labelKey: 'nav.pricing' },
      { to: ROUTES.demo, labelKey: 'nav.demo' },
    ],
  },
  {
    titleKey: 'footer.company',
    links: [
      { to: ROUTES.faq, labelKey: 'nav.faq' },
      { to: ROUTES.contacts, labelKey: 'nav.contacts' },
    ],
  },
  {
    titleKey: 'footer.legal',
    links: [
      { to: ROUTES.privacy, labelKey: 'footer.privacy' },
      { to: ROUTES.terms, labelKey: 'footer.terms' },
    ],
  },
];

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.grid}>
          <div className={styles.about}>
            <Link to={ROUTES.home} className={styles.brand} aria-label={`${t('brand')} — ${t('nav.home')}`}>
              <Logo inverse />
            </Link>
            <p className={styles.tagline}>{t('footer.tagline')}</p>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.titleKey} aria-label={t(column.titleKey)} className={styles.column}>
              <h2 className={styles.columnTitle}>{t(column.titleKey)}</h2>
              <ul className={styles.links}>
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className={styles.link}>
                      {t(link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className={styles.bottom}>
          <p>{t('footer.rights', { year })}</p>
          <p>{t('footer.madeFor')}</p>
        </div>
      </Container>
    </footer>
  );
}
