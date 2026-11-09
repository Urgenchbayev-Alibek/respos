import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Button } from '@/shared/ui';
import { NotFoundPage } from './NotFoundPage';
import { StatusPage } from './StatusPage';

/** Router error boundary: render crashes and failed lazy chunks (after a deploy → reload helps). */
export function RouteErrorPage() {
  const { t } = useTranslation();
  const error = useRouteError();

  useEffect(() => {
    console.error('[router] unhandled route error', error);
  }, [error]);

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <StatusPage
      code="500"
      title={t('errors:pages.crashTitle')}
      description={t('errors:pages.crashDescription')}
      actions={<Button variant="primary" onClick={() => window.location.reload()}>{t('errors:pages.reload')}</Button>}
    />
  );
}
