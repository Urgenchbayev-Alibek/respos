import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/** Menu management (dishes, categories, modifier groups). */
export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.menu,
    element: lazyPage(() => import('@/pages/admin/menu/MenuPage').then((m) => ({ default: m.MenuPage })), {
      anyOf: [P.menu.read],
    }),
  },
]);
