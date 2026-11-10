import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CalendarX } from 'lucide-react';
import { env } from '@/shared/config/env';
import { ROUTES } from '@/shared/config/routes';
import { usePageMeta } from '@/shared/lib/usePageMeta';
import { Container } from '@/shared/ui/Container';
import { Section } from '@/shared/ui/Section';
import { BookingForm } from '@/widgets/booking/BookingForm';
import bookingStyles from '@/widgets/booking/BookingForm.module.css';
import styles from './Pages.module.css';

/** «Забронировать стол». The branch comes from VITE_PUBLIC_BRANCH_ID (switches to the branch slug once it exists). */
export function BookingPage({ branchId = env.publicBranchId }: { branchId?: string | null }) {
  const { t } = useTranslation();
  usePageMeta(t('meta.booking.title'), t('meta.booking.description'));
  return (
    <>
      <Section headingLevel="h1" title={t('booking.title')} lead={t('booking.lead')} />
      <Container className={styles.pageBody}>
        <div className={styles.formCard}>
          {branchId ? (
            <BookingForm branchId={branchId} />
          ) : (
            <div className={bookingStyles.notice} role="status">
              <CalendarX aria-hidden="true" width={40} height={40} />
              <h2 className={styles.cardTitle}>{t('booking.notConnected.title')}</h2>
              <p>{t('booking.notConnected.text')}</p>
              <p><Link to={ROUTES.contacts}>{t('nav.contacts')}</Link></p>
            </div>
          )}
        </div>
      </Container>
    </>
  );
}
