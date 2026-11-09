import { Construction } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../EmptyState/EmptyState';
import { PageHeader } from '../PageHeader/PageHeader';

export interface ComingSoonProps {
  /** i18n key of the section title, e.g. `nav:admin.menu`. */
  titleKey: string;
}

/** PLACEHOLDER for a section that is not implemented yet. Replace the stub route with the real page. */
export function ComingSoon({ titleKey }: ComingSoonProps) {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t(titleKey)} />
      <EmptyState
        icon={<Construction />}
        title={t('common:comingSoon.title')}
        description={t('common:comingSoon.description')}
      />
    </>
  );
}
