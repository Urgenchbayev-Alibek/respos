import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.reports,
    element: lazyPage(() => import('@/pages/admin/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })), {
      anyOf: [P.reports.read],
    }),
  },
]);
