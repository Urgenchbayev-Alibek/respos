import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/** F7: Platform → integration errors (platform.system.read). */
export const routeModule = defineRoutes('platform', [
  {
    path: ROUTES.platform.integrationErrors,
    element: lazyPage(() => import('@/pages/platform/IntegrationErrorsPage').then((m) => ({ default: m.IntegrationErrorsPage })), {
      anyOf: [P.platform.systemRead],
    }),
  },
]);
