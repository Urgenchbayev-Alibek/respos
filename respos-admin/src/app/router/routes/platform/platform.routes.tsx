import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/** Platform Super Admin (IsPlatformAdmin). Backend enforces; guards are UX only. */
export const routeModule = defineRoutes('platform', [
  {
    index: true,
    element: lazyPage(() => import('@/pages/platform/OrganizationsPage').then((m) => ({ default: m.OrganizationsPage })), {
      anyOf: [P.platform.organizationsRead],
    }),
  },
  {
    path: ROUTES.platform.plans,
    element: lazyPage(() => import('@/pages/platform/PlansPage').then((m) => ({ default: m.PlansPage })), {
      anyOf: [P.platform.plansManage],
    }),
  },
  {
    path: ROUTES.platform.featureFlags,
    element: lazyPage(() => import('@/pages/platform/FeatureFlagsPage').then((m) => ({ default: m.FeatureFlagsPage })), {
      anyOf: [P.platform.featureFlagsManage],
    }),
  },
  {
    path: ROUTES.platform.system,
    element: lazyPage(() => import('@/pages/platform/SystemPage').then((m) => ({ default: m.SystemPage })), {
      anyOf: [P.platform.systemRead],
    }),
  },
  {
    path: ROUTES.platform.demoRequests,
    element: lazyPage(() => import('@/pages/platform/DemoRequestsPage').then((m) => ({ default: m.DemoRequestsPage })), {
      anyOf: [P.platform.demoRequestsRead],
    }),
  },
]);
