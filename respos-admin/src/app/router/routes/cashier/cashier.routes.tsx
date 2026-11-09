import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

export const routeModule = defineRoutes('cashier', [
  {
    index: true,
    element: lazyPage(() => import('@/pages/cashier/CashierOrdersPage').then((m) => ({ default: m.CashierOrdersPage })), {
      anyOf: [P.orders.read],
    }),
  },
  {
    path: ROUTES.cashier.shift,
    element: lazyPage(() => import('@/pages/cashier/CashierShiftPage').then((m) => ({ default: m.CashierShiftPage })), {
      anyOf: [P.cashShifts.read],
    }),
  },
  {
    path: ROUTES.cashier.payments,
    element: lazyPage(() => import('@/pages/cashier/CashierPaymentsPage').then((m) => ({ default: m.CashierPaymentsPage })), {
      anyOf: [P.payments.read],
    }),
  },
]);
