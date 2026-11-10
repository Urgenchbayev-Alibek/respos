import { Route, Routes } from 'react-router-dom';
import { BookingPage } from '@/pages/BookingPage';
import { ContactsPage } from '@/pages/ContactsPage';
import { DemoPage } from '@/pages/DemoPage';
import { FaqPage } from '@/pages/FaqPage';
import { FeaturesPage } from '@/pages/FeaturesPage';
import { HomePage } from '@/pages/HomePage';
import { PrivacyPage, TermsPage } from '@/pages/LegalPages';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PricingPage } from '@/pages/PricingPage';
import { ROUTES } from '@/shared/config/routes';
import { Layout } from './Layout';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path={ROUTES.features} element={<FeaturesPage />} />
        <Route path={ROUTES.pricing} element={<PricingPage />} />
        <Route path={ROUTES.faq} element={<FaqPage />} />
        <Route path={ROUTES.contacts} element={<ContactsPage />} />
        <Route path={ROUTES.demo} element={<DemoPage />} />
        <Route path={ROUTES.booking} element={<BookingPage />} />
        <Route path={ROUTES.privacy} element={<PrivacyPage />} />
        <Route path={ROUTES.terms} element={<TermsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
