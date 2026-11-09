import { defineRoutes, stubPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/**
 * STUB (planned owner: agent C). Replace `stubPage(...)` with
 * `lazyPage(() => import('@/pages/...').then((m) => ({ default: m.XxxPage })), { anyOf: [...] })`.
 */
export const routeModule = defineRoutes('platform', [
  { index: true, element: stubPage('nav:platform.organizations', { anyOf: [P.platform.organizationsRead] }) },
  { path: ROUTES.platform.plans, element: stubPage('nav:platform.plans', { anyOf: [P.platform.plansManage] }) },
  { path: ROUTES.platform.featureFlags, element: stubPage('nav:platform.featureFlags', { anyOf: [P.platform.featureFlagsManage] }) },
  { path: ROUTES.platform.system, element: stubPage('nav:platform.system', { anyOf: [P.platform.systemRead] }) },
  { path: ROUTES.platform.demoRequests, element: stubPage('nav:platform.demoRequests', { anyOf: [P.platform.demoRequestsRead] }) },
]);
