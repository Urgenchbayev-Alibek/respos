import { Navigate } from 'react-router-dom';
import { resolveDefaultWorkspace } from '@/app/navigation/workspaces';
import { ForbiddenPage } from '@/pages/errors/ForbiddenPage';
import { useAuth } from '@/shared/hooks/use-auth';

/** `/` → default workspace by role/permissions. */
export function HomeRedirect() {
  const { user } = useAuth();
  const workspace = resolveDefaultWorkspace(user);
  if (!workspace) return <ForbiddenPage />;
  return <Navigate to={workspace.path} replace />;
}
