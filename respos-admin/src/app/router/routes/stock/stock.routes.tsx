import { defineRoutes, stubPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/**
 * STUB (planned owner: agent C). Replace `stubPage(...)` with
 * `lazyPage(() => import('@/pages/...').then((m) => ({ default: m.XxxPage })), { anyOf: [...] })`.
 */
export const routeModule = defineRoutes('stock', [
  { index: true, element: stubPage('nav:stock.inventory', { anyOf: [P.inventory.read] }) },
  { path: ROUTES.stock.purchases, element: stubPage('nav:stock.purchases', { anyOf: [P.purchases.read] }) },
  { path: ROUTES.stock.counts, element: stubPage('nav:stock.counts', { anyOf: [P.inventory.adjust] }) },
]);
