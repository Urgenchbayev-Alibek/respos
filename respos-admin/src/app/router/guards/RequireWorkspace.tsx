import type { ReactNode } from 'react';
import { canAccessWorkspace, getWorkspace, type WorkspaceId } from '@/app/navigation/workspaces';
import { ForbiddenPage } from '@/pages/errors/ForbiddenPage';
import { useAuth } from '@/shared/hooks/use-auth';

/** Blocks a whole workspace (layout + all its pages) if the user cannot use it. */
export function RequireWorkspace({ workspace, children }: { workspace: WorkspaceId; children: ReactNode }) {
  const { user } = useAuth();
  if (!canAccessWorkspace(user, getWorkspace(workspace))) return <ForbiddenPage />;
  return <>{children}</>;
}
