import { defineRoutes, stubPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/**
 * STUB (planned owner: agent B). Replace `stubPage(...)` with
 * `lazyPage(() => import('@/pages/...').then((m) => ({ default: m.XxxPage })), { anyOf: [...] })`.
 */
export const routeModule = defineRoutes('cashier', [
  { index: true, element: stubPage('nav:cashier.orders', { anyOf: [P.orders.read] }) },
  { path: ROUTES.cashier.shift, element: stubPage('nav:cashier.shift', { anyOf: [P.cashShifts.read] }) },
  { path: ROUTES.cashier.payments, element: stubPage('nav:cashier.payments', { anyOf: [P.payments.read] }) },
]);
