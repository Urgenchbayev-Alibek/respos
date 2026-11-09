import { useTranslation } from 'react-i18next';
import { usePageMeta } from '@/shared/lib/usePageMeta';
import { Section } from '@/shared/ui/Section';
import { CtaBanner } from '@/widgets/cta/CtaBanner';
import { FeatureList } from '@/widgets/features/FeatureList';

export function FeaturesPage() {
  const { t } = useTranslation();
  usePageMeta(t('meta.features.title'), t('meta.features.description'));
  return (
    <>
      <Section headingLevel="h1" title={t('features.title')} lead={t('features.lead')} />
      <FeatureList />
      <CtaBanner />
    </>
  );
}
