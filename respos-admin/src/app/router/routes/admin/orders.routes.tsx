import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/** Orders list with filters + details drawer. */
export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.orders,
    element: lazyPage(() => import('@/pages/admin/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })), {
      anyOf: [P.orders.read],
    }),
  },
]);
