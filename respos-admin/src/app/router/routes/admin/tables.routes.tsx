import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/** Dining areas, tables and the floor plan. */
export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.tables,
    element: lazyPage(() => import('@/pages/admin/tables/TablesPage').then((m) => ({ default: m.TablesPage })), {
      anyOf: [P.tables.read],
    }),
  },
]);
