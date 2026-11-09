import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/shared/constants/routes';
import { useAuth } from '@/shared/hooks/use-auth';
import { Button } from '@/shared/ui';
import { StatusPage } from './StatusPage';

export function ForbiddenPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  return (
    <StatusPage
      code="403"
      title={t('errors:pages.forbiddenTitle')}
      description={t('errors:pages.forbiddenDescription')}
      actions={
        <>
          <Button onClick={() => navigate(ROUTES.home)}>{t('errors:pages.goHome')}</Button>
          <Button variant="ghost" onClick={() => void logout().then(() => navigate(ROUTES.login))}>
            {t('errors:pages.switchAccount')}
          </Button>
        </>
      }
    />
  );
}
