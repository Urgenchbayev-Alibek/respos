import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/** Waiter workspace: live floor, active orders, order screen (new / existing), reservations. */
export const routeModule = defineRoutes('waiter', [
  {
    index: true,
    element: lazyPage(() => import('@/pages/waiter/floor/WaiterFloorPage').then((m) => ({ default: m.WaiterFloorPage })), {
      anyOf: [P.tables.read],
    }),
  },
  {
    path: ROUTES.waiter.orders,
    element: lazyPage(() => import('@/pages/waiter/orders/WaiterOrdersPage').then((m) => ({ default: m.WaiterOrdersPage })), {
      anyOf: [P.orders.read],
    }),
  },
  {
    path: ROUTES.waiter.newOrder,
    element: lazyPage(() => import('@/pages/waiter/order/WaiterOrderPage').then((m) => ({ default: m.WaiterOrderPage })), {
      anyOf: [P.orders.create],
    }),
  },
  {
    path: ROUTES.waiter.order,
    element: lazyPage(() => import('@/pages/waiter/order/WaiterOrderPage').then((m) => ({ default: m.WaiterOrderPage })), {
      anyOf: [P.orders.read],
    }),
  },
  {
    path: ROUTES.waiter.reservations,
    element: lazyPage(
      () => import('@/pages/admin/reservations/ReservationsPage').then((m) => ({ default: m.ReservationsPage })),
      { anyOf: [P.reservations.read] },
    ),
  },
]);
