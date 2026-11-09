import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.suppliers,
    element: lazyPage(() => import('@/pages/stock/suppliers/SuppliersPage').then((m) => ({ default: m.SuppliersPage })), {
      anyOf: [P.suppliers.read],
    }),
  },
]);
