import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.inventory,
    element: lazyPage(() => import('@/pages/stock/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })), {
      anyOf: [P.inventory.read],
    }),
  },
]);
