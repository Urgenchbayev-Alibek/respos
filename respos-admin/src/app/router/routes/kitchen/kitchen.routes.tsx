import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';

export const routeModule = defineRoutes('kitchen', [
  {
    index: true,
    element: lazyPage(() => import('@/pages/kitchen/KitchenBoardPage').then((m) => ({ default: m.KitchenBoardPage })), {
      anyOf: [P.kitchen.read],
    }),
  },
]);
