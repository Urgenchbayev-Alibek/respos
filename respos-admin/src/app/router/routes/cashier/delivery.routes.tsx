import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/** F3: delivery board in the cashier workspace. */
export const routeModule = defineRoutes('cashier', [
  {
    path: ROUTES.cashier.delivery,
    element: lazyPage(() => import('@/pages/delivery/DeliveryBoardPage').then((m) => ({ default: m.DeliveryBoardPage })), {
      anyOf: [P.delivery.read],
    }),
  },
]);
