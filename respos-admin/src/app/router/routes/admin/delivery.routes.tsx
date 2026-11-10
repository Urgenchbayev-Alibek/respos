import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/** F3: delivery board and table QR codes. */
export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.delivery,
    element: lazyPage(() => import('@/pages/delivery/DeliveryBoardPage').then((m) => ({ default: m.DeliveryBoardPage })), {
      anyOf: [P.delivery.read],
    }),
  },
  {
    path: ROUTES.admin.tableQr,
    element: lazyPage(() => import('@/pages/admin/tables/TableQrPage').then((m) => ({ default: m.TableQrPage })), {
      anyOf: [P.tables.manage],
    }),
  },
]);
