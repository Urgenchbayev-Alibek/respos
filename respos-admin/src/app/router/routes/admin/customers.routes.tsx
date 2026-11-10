import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/** F1 — guests (CRM) and loyalty settings. */
export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.customers,
    element: lazyPage(() => import('@/pages/admin/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })), {
      anyOf: [P.customers.read],
    }),
  },
  {
    path: ROUTES.admin.loyalty,
    element: lazyPage(() => import('@/pages/admin/customers/LoyaltySettingsPage').then((m) => ({ default: m.LoyaltySettingsPage })), {
      anyOf: [P.customers.read, P.customers.manage],
    }),
  },
  {
    path: ROUTES.admin.customerDetail,
    element: lazyPage(() => import('@/pages/admin/customers/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })), {
      anyOf: [P.customers.read],
    }),
  },
]);
