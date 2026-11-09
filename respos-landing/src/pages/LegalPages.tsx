import { useTranslation } from 'react-i18next';
import { usePageMeta } from '@/shared/lib/usePageMeta';
import { LegalDraft } from '@/widgets/legal/LegalDraft';

export function PrivacyPage() {
  const { t } = useTranslation();
  usePageMeta(t('meta.privacy.title'), t('meta.privacy.description'));
  return <LegalDraft doc="privacy" />;
}

export function TermsPage() {
  const { t } = useTranslation();
  usePageMeta(t('meta.terms.title'), t('meta.terms.description'));
  return <LegalDraft doc="terms" />;
}
