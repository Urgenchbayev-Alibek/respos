import { defineRoutes, stubPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';

/**
 * STUB (planned owner: agent B). Replace `stubPage(...)` with
 * `lazyPage(() => import('@/pages/...').then((m) => ({ default: m.XxxPage })), { anyOf: [...] })`.
 */
export const routeModule = defineRoutes('kitchen', [
  { index: true, element: stubPage('nav:workspaces.kitchen', { anyOf: [P.kitchen.read] }) },
]);
