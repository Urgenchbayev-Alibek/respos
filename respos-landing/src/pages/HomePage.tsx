import { useTranslation } from 'react-i18next';
import { usePageMeta } from '@/shared/lib/usePageMeta';
import { CtaBanner } from '@/widgets/cta/CtaBanner';
import { Hero } from '@/widgets/hero/Hero';
import { HowItWorks } from '@/widgets/home/HowItWorks';
import { RolesSection } from '@/widgets/home/RolesSection';
import { Showcase } from '@/widgets/home/Showcase';
import { ModulesGrid } from '@/widgets/modules/ModulesGrid';

export function HomePage() {
  const { t } = useTranslation();
  usePageMeta(t('meta.home.title'), t('meta.home.description'));
  return (
    <>
      <Hero />
      <RolesSection />
      <ModulesGrid />
      <Showcase />
      <HowItWorks />
      <CtaBanner />
    </>
  );
}
