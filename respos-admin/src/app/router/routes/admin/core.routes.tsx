import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/** Admin sections implemented in the foundation: dashboard, branches, users & roles, settings. */
export const routeModule = defineRoutes('admin', [
  {
    index: true,
    element: lazyPage(() => import('@/pages/admin/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage }))),
  },
  {
    path: ROUTES.admin.branches,
    element: lazyPage(() => import('@/pages/admin/branches/BranchesPage').then((m) => ({ default: m.BranchesPage })), {
      anyOf: [P.branches.read],
    }),
  },
  {
    path: ROUTES.admin.branchSettings,
    element: lazyPage(
      () => import('@/pages/admin/branches/BranchSettingsPage').then((m) => ({ default: m.BranchSettingsPage })),
      { anyOf: [P.settings.manage] },
    ),
  },
  {
    path: ROUTES.admin.users,
    element: lazyPage(() => import('@/pages/admin/users/UsersPage').then((m) => ({ default: m.UsersPage })), {
      anyOf: [P.users.read],
    }),
  },
  {
    path: ROUTES.admin.roles,
    element: lazyPage(() => import('@/pages/admin/roles/RolesPage').then((m) => ({ default: m.RolesPage })), {
      anyOf: [P.roles.read],
    }),
  },
  {
    path: ROUTES.admin.roleNew,
    element: lazyPage(() => import('@/pages/admin/roles/RoleEditorPage').then((m) => ({ default: m.RoleEditorPage })), {
      anyOf: [P.roles.manage],
    }),
  },
  {
    path: ROUTES.admin.roleEdit,
    element: lazyPage(() => import('@/pages/admin/roles/RoleEditorPage').then((m) => ({ default: m.RoleEditorPage })), {
      anyOf: [P.roles.read],
    }),
  },
  {
    path: ROUTES.admin.settings,
    element: lazyPage(() => import('@/pages/admin/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })), {
      anyOf: [P.settings.manage],
    }),
  },
]);
