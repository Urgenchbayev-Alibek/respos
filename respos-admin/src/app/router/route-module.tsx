import { lazy, Suspense, type ComponentType, type ReactElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import type { WorkspaceId } from '@/app/navigation/workspaces';
import type { Permission } from '@/shared/constants/permissions';
import { ComingSoon, PageLoader } from '@/shared/ui';
import { RequirePermission } from './guards/RequirePermission';

/**
 * Where a route module's routes are mounted:
 * - a workspace id → inside that workspace layout (requires auth + workspace access)
 * - `account` → signed-in pages outside any workspace (profile)
 * - `public` → no auth (login, password reset, invitation)
 */
export type RouteScope = WorkspaceId | 'account' | 'public';

export interface RouteModule {
  scope: RouteScope;
  routes: RouteObject[];
}

export function defineRoutes(scope: RouteScope, routes: RouteObject[]): RouteModule {
  return { scope, routes };
}

export interface PageGuard {
  anyOf?: readonly Permission[];
  allOf?: readonly Permission[];
}

/**
 * Lazy-loaded page element with optional permission guard:
 * `element: lazyPage(() => import('@/pages/admin/menu/MenuPage').then((m) => ({ default: m.MenuPage })), { anyOf: [P.menu.read] })`
 */
export function lazyPage(loader: () => Promise<{ default: ComponentType }>, guard: PageGuard = {}): ReactElement {
  const Page = lazy(loader);
  return (
    <RequirePermission anyOf={guard.anyOf} allOf={guard.allOf}>
      <Suspense fallback={<PageLoader />}>
        <Page />
      </Suspense>
    </RequirePermission>
  );
}

/** PLACEHOLDER route element for a section that is not built yet. Replace with `lazyPage(...)`. */
export function stubPage(titleKey: string, guard: PageGuard = {}): ReactElement {
  return (
    <RequirePermission anyOf={guard.anyOf} allOf={guard.allOf}>
      <ComingSoon titleKey={titleKey} />
    </RequirePermission>
  );
}
