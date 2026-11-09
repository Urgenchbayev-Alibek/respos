import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.auditLogs,
    element: lazyPage(() => import('@/pages/admin/audit-logs/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })), {
      anyOf: [P.audit.read],
    }),
  },
]);
