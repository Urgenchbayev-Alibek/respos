import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { ForbiddenPage } from '@/pages/errors/ForbiddenPage';
import type { Permission } from '@/shared/constants/permissions';
import { usePermissions } from '@/shared/hooks/use-permissions';

export interface RequirePermissionProps {
  /** Allowed if the user has ANY of these. */
  anyOf?: readonly Permission[];
  /** Allowed only if the user has ALL of these. */
  allOf?: readonly Permission[];
  children?: ReactNode;
  /** Render instead of the 403 page (e.g. `null` to just hide a widget). */
  fallback?: ReactNode;
}

/** Route / UI guard. UX only — the backend still enforces every permission. */
export function RequirePermission({ anyOf = [], allOf = [], children, fallback }: RequirePermissionProps) {
  const { hasAny, hasAll } = usePermissions();
  const allowed = hasAny(anyOf) && hasAll(allOf);
  if (!allowed) return <>{fallback === undefined ? <ForbiddenPage /> : fallback}</>;
  return <>{children ?? <Outlet />}</>;
}
