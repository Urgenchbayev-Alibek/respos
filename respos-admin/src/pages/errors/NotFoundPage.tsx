import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/ui';
import { StatusPage } from './StatusPage';

export function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <StatusPage
      code="404"
      title={t('errors:pages.notFoundTitle')}
      description={t('errors:pages.notFoundDescription')}
      actions={<Button onClick={() => navigate(ROUTES.home)}>{t('errors:pages.goHome')}</Button>}
    />
  );
}
