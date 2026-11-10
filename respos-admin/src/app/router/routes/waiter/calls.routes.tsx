import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/** F3: guest calls from table QR menus. */
export const routeModule = defineRoutes('waiter', [
  {
    path: ROUTES.waiter.calls,
    element: lazyPage(() => import('@/pages/waiter/calls/WaiterCallsPage').then((m) => ({ default: m.WaiterCallsPage })), {
      anyOf: [P.orders.read],
    }),
  },
]);
