import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/** Kitchen stations CRUD (branch-scoped). */
export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.kitchenStations,
    element: lazyPage(
      () => import('@/pages/admin/kitchen-stations/KitchenStationsPage').then((m) => ({ default: m.KitchenStationsPage })),
      { anyOf: [P.kitchen.read] },
    ),
  },
]);
