import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.notifications,
    element: lazyPage(
      () => import('@/pages/admin/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
      { anyOf: [P.notifications.read] },
    ),
  },
]);
