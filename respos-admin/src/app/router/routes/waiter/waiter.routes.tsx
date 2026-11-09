import { defineRoutes, stubPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/**
 * STUB (planned owner: agent A). Replace `stubPage(...)` with
 * `lazyPage(() => import('@/pages/...').then((m) => ({ default: m.XxxPage })), { anyOf: [...] })`.
 */
export const routeModule = defineRoutes('waiter', [
  { index: true, element: stubPage('nav:waiter.tables', { anyOf: [P.tables.read] }) },
  { path: ROUTES.waiter.orders, element: stubPage('nav:waiter.orders', { anyOf: [P.orders.read] }) },
  { path: ROUTES.waiter.reservations, element: stubPage('nav:waiter.reservations', { anyOf: [P.reservations.read] }) },
]);
