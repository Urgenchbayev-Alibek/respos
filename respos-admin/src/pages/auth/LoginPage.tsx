import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LoginForm } from '@/features/auth/ui/LoginForm';
import { ROUTES } from '@/shared/constants/routes';
import { useAuth } from '@/shared/hooks/use-auth';
import { PageLoader } from '@/shared/ui';
import { AuthCard } from './AuthCard';

function safeRedirect(from: unknown): string {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : ROUTES.home;
}

export function LoginPage() {
  const { t } = useTranslation();
  const { status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const target = safeRedirect((location.state as { from?: unknown } | null)?.from);

  if (status === 'loading') return <PageLoader />;
  if (status === 'authenticated') return <Navigate to={target} replace />;

  return (
    <AuthCard title={t('auth:login.title')} subtitle={t('auth:login.subtitle')}>
      <LoginForm onSuccess={() => navigate(target, { replace: true })} />
    </AuthCard>
  );
}
