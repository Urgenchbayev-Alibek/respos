/**
 * Mirror of respos-contracts/PERMISSIONS.md — the ONLY place on the frontend where
 * permission strings are defined. Frontend checks are UX only; the backend enforces.
 */
export const PERMISSIONS = {
  users: { read: 'users.read', create: 'users.create', update: 'users.update', deactivate: 'users.deactivate' },
  roles: { read: 'roles.read', manage: 'roles.manage' },
  branches: { read: 'branches.read', manage: 'branches.manage' },
  menu: { read: 'menu.read', manage: 'menu.manage' },
  tables: { read: 'tables.read', manage: 'tables.manage' },
  reservations: { read: 'reservations.read', manage: 'reservations.manage' },
  orders: {
    read: 'orders.read',
    create: 'orders.create',
    update: 'orders.update',
    cancel: 'orders.cancel',
    discountApply: 'orders.discount.apply',
    transfer: 'orders.transfer',
    split: 'orders.split',
  },
  kitchen: { read: 'kitchen.read', statusUpdate: 'kitchen.status.update', stationsManage: 'kitchen.stations.manage' },
  inventory: { read: 'inventory.read', manage: 'inventory.manage', adjust: 'inventory.adjust', transfer: 'inventory.transfer' },
  recipes: { read: 'recipes.read', manage: 'recipes.manage' },
  suppliers: { read: 'suppliers.read', manage: 'suppliers.manage' },
  purchases: { read: 'purchases.read', manage: 'purchases.manage', receive: 'purchases.receive' },
  payments: { read: 'payments.read', create: 'payments.create', refund: 'payments.refund' },
  cashShifts: { read: 'cash-shifts.read', open: 'cash-shifts.open', close: 'cash-shifts.close' },
  reports: { read: 'reports.read', export: 'reports.export' },
  customers: { read: 'customers.read', manage: 'customers.manage', loyaltyRedeem: 'loyalty.redeem' },
  delivery: { read: 'delivery.read', manage: 'delivery.manage' },
  staff: { timeClock: 'staff.timeclock', manage: 'staff.manage' },
  integrations: { manage: 'integrations.manage' },
  notifications: { read: 'notifications.read' },
  settings: { manage: 'settings.manage' },
  audit: { read: 'audit.read' },
  platform: {
    organizationsRead: 'platform.organizations.read',
    organizationsManage: 'platform.organizations.manage',
    plansManage: 'platform.plans.manage',
    featureFlagsManage: 'platform.feature-flags.manage',
    systemRead: 'platform.system.read',
    demoRequestsRead: 'platform.demo-requests.read',
    tenantDataAccess: 'platform.tenant-data.access',
  },
} as const;

type Leaves<T> = { [K in keyof T]: T[K] extends string ? T[K] : Leaves<T[K]> }[keyof T];

export type Permission = Leaves<typeof PERMISSIONS>;

const PLATFORM_PERMISSION_PREFIX = 'platform.';

export function isPlatformPermission(code: string): boolean {
  return code.startsWith(PLATFORM_PERMISSION_PREFIX);
}

/** System role codes seeded per organization (PERMISSIONS.md "Default system roles"). */
export const SYSTEM_ROLES = {
  owner: 'owner',
  admin: 'admin',
  manager: 'manager',
  waiter: 'waiter',
  cook: 'cook',
  cashier: 'cashier',
  stockkeeper: 'stockkeeper',
  accountant: 'accountant',
} as const;
