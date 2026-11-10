/** Absolute paths for every screen. Route modules and links both use these — never hardcode paths. */
export const ROUTES = {
  home: '/',
  login: '/login',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  acceptInvitation: '/accept-invitation',
  forbidden: '/403',
  profile: '/profile',
  /** Shared-device lock screen (PIN quick login, F6). */
  device: '/device',
  admin: {
    root: '/admin',
    dashboard: '/admin',
    branches: '/admin/branches',
    branchSettings: '/admin/branches/:branchId/settings',
    users: '/admin/users',
    roles: '/admin/roles',
    roleNew: '/admin/roles/new',
    roleEdit: '/admin/roles/:roleId',
    tables: '/admin/tables',
    reservations: '/admin/reservations',
    menu: '/admin/menu',
    kitchenStations: '/admin/kitchen-stations',
    orders: '/admin/orders',
    inventory: '/admin/inventory',
    recipes: '/admin/recipes',
    suppliers: '/admin/suppliers',
    purchases: '/admin/purchases',
    purchaseDetail: '/admin/purchases/:purchaseId',
    payments: '/admin/payments',
    cashShifts: '/admin/cash-shifts',
    reports: '/admin/reports',
    notifications: '/admin/notifications',
    auditLogs: '/admin/audit-logs',
    settings: '/admin/settings',
    customers: '/admin/customers',
    customerDetail: '/admin/customers/:customerId',
    loyalty: '/admin/customers/loyalty',
    staff: '/admin/staff',
    staffTimesheet: '/admin/staff/timesheet',
    staffSchedule: '/admin/staff/schedule',
    staffMembers: '/admin/staff/members',
    staffDevices: '/admin/staff/devices',
  },
  waiter: {
    root: '/waiter',
    tables: '/waiter',
    orders: '/waiter/orders',
    newOrder: '/waiter/orders/new',
    order: '/waiter/orders/:orderId',
    reservations: '/waiter/reservations',
  },
  kitchen: { root: '/kitchen', board: '/kitchen' },
  cashier: { root: '/cashier', orders: '/cashier', shift: '/cashier/shift', payments: '/cashier/payments' },
  stock: {
    root: '/stock',
    inventory: '/stock',
    purchases: '/stock/purchases',
    purchaseDetail: '/stock/purchases/:purchaseId',
    counts: '/stock/counts',
    suppliers: '/stock/suppliers',
    recipes: '/stock/recipes',
  },
  platform: {
    root: '/platform',
    organizations: '/platform',
    plans: '/platform/plans',
    featureFlags: '/platform/feature-flags',
    system: '/platform/system',
    demoRequests: '/platform/demo-requests',
  },
} as const;

/** Fills `:param` placeholders: buildPath(ROUTES.admin.roleEdit, { roleId }) */
export function buildPath(pattern: string, params: Record<string, string | number>): string {
  return pattern.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
    const value = params[key];
    if (value === undefined) throw new Error(`Missing route param "${key}" for ${pattern}`);
    return encodeURIComponent(String(value));
  });
}
