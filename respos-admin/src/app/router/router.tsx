import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AccountLayout } from '@/app/layouts/AccountLayout';
import { AdminLayout } from '@/app/layouts/AdminLayout/AdminLayout';
import { KitchenLayout } from '@/app/layouts/KitchenLayout/KitchenLayout';
import { CashierLayout, PlatformLayout, StockLayout, WaiterLayout } from '@/app/layouts/workspace-layouts';
import { WORKSPACES, type WorkspaceId } from '@/app/navigation/workspaces';
import { ForbiddenPage } from '@/pages/errors/ForbiddenPage';
import { NotFoundPage } from '@/pages/errors/NotFoundPage';
import { RouteErrorPage } from '@/pages/errors/RouteErrorPage';
import { ROUTES } from '@/shared/constants/routes';
import { RequireAuth } from './guards/RequireAuth';
import { RequireWorkspace } from './guards/RequireWorkspace';
import { HomeRedirect } from './HomeRedirect';
import { collectRoutes } from './route-registry';

const LAYOUTS: Record<WorkspaceId, ComponentType> = {
  admin: AdminLayout,
  waiter: WaiterLayout,
  kitchen: KitchenLayout,
  cashier: CashierLayout,
  stock: StockLayout,
  platform: PlatformLayout,
};

export function buildRoutes(): RouteObject[] {
  const routes = collectRoutes();
  const workspaceRoutes: RouteObject[] = WORKSPACES.map((workspace) => {
    const Layout = LAYOUTS[workspace.id];
    return {
      path: workspace.path,
      element: (
        <RequireWorkspace workspace={workspace.id}>
          <Layout />
        </RequireWorkspace>
      ),
      children: [...routes[workspace.id], { path: '*', element: <NotFoundPage /> }],
    };
  });

  return [
    {
      errorElement: <RouteErrorPage />,
      children: [
        ...routes.public,
        {
          element: <RequireAuth />,
          children: [
            { path: ROUTES.home, element: <HomeRedirect /> },
            { path: ROUTES.forbidden, element: <ForbiddenPage /> },
            { element: <AccountLayout />, children: routes.account },
            ...workspaceRoutes,
          ],
        },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ];
}

export function createAppRouter() {
  return createBrowserRouter(buildRoutes(), {
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  });
}
