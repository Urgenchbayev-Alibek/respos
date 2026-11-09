import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.payments,
    element: lazyPage(() => import('@/pages/admin/payments/PaymentsPage').then((m) => ({ default: m.PaymentsPage })), {
      anyOf: [P.payments.read],
    }),
  },
]);
