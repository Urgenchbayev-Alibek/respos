import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.cashShifts,
    element: lazyPage(() => import('@/pages/admin/cash-shifts/CashShiftsPage').then((m) => ({ default: m.CashShiftsPage })), {
      anyOf: [P.cashShifts.read],
    }),
  },
]);
