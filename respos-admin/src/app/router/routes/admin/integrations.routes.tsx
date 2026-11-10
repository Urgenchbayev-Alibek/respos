import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/** F7: integrations settings + outbound log (integrations.manage). */
export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.integrations,
    element: lazyPage(
      () => import('@/pages/admin/integrations/IntegrationsPage').then((m) => ({ default: m.IntegrationsPage })),
      { anyOf: [P.integrations.manage] },
    ),
  },
  {
    path: ROUTES.admin.integrationsOutbound,
    element: lazyPage(
      () => import('@/pages/admin/integrations/OutboundMessagesPage').then((m) => ({ default: m.OutboundMessagesPage })),
      { anyOf: [P.integrations.manage] },
    ),
  },
]);
