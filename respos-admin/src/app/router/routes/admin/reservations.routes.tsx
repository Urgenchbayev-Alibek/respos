import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/** Reservations: day timeline + list, create/edit, status actions. */
export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.reservations,
    element: lazyPage(
      () => import('@/pages/admin/reservations/ReservationsPage').then((m) => ({ default: m.ReservationsPage })),
      { anyOf: [P.reservations.read] },
    ),
  },
]);
