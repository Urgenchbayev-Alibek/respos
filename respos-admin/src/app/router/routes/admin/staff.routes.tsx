import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

const guard = { anyOf: [P.staff.manage] } as const;

/** Admin → Staff (F6): time entries, timesheet, schedule, members (PIN), shared devices. */
export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.staff,
    element: lazyPage(() => import('@/pages/admin/staff/TimeEntriesPage').then((m) => ({ default: m.TimeEntriesPage })), guard),
  },
  {
    path: ROUTES.admin.staffTimesheet,
    element: lazyPage(() => import('@/pages/admin/staff/TimesheetPage').then((m) => ({ default: m.TimesheetPage })), guard),
  },
  {
    path: ROUTES.admin.staffSchedule,
    element: lazyPage(() => import('@/pages/admin/staff/SchedulePage').then((m) => ({ default: m.SchedulePage })), guard),
  },
  {
    path: ROUTES.admin.staffMembers,
    element: lazyPage(() => import('@/pages/admin/staff/StaffMembersPage').then((m) => ({ default: m.StaffMembersPage })), guard),
  },
  {
    path: ROUTES.admin.staffDevices,
    element: lazyPage(() => import('@/pages/admin/staff/DevicesPage').then((m) => ({ default: m.DevicesPage })), guard),
  },
]);
