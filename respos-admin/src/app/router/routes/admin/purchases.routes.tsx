import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.purchases,
    element: lazyPage(() => import('@/pages/stock/purchases/PurchasesPage').then((m) => ({ default: m.PurchasesPage })), {
      anyOf: [P.purchases.read],
    }),
  },
  {
    path: ROUTES.admin.purchaseDetail,
    element: lazyPage(
      () => import('@/pages/stock/purchases/PurchaseDetailPage').then((m) => ({ default: m.PurchaseDetailPage })),
      { anyOf: [P.purchases.read] },
    ),
  },
]);
