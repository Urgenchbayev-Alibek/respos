import { useTranslation } from 'react-i18next';
import { usePageMeta } from '@/shared/lib/usePageMeta';
import { Section } from '@/shared/ui/Section';
import { PricingPlans } from '@/widgets/pricing/PricingPlans';

export function PricingPage() {
  const { t } = useTranslation();
  usePageMeta(t('meta.pricing.title'), t('meta.pricing.description'));
  return (
    <>
      <Section headingLevel="h1" align="center" title={t('pricing.title')} lead={t('pricing.lead')} />
      <PricingPlans />
    </>
  );
}
