import { defineRoutes, stubPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/**
 * STUB (planned owner: agent B). Replace `stubPage(...)` with
 * `lazyPage(() => import('@/pages/...').then((m) => ({ default: m.XxxPage })), { anyOf: [...] })`.
 */
export const routeModule = defineRoutes('admin', [
  { path: ROUTES.admin.payments, element: stubPage('nav:admin.payments', { anyOf: [P.payments.read] }) },
]);
