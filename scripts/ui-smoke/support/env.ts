/** Server URLs and demo credentials (Development seed only). Override via env for another host. */
export const ADMIN_URL = process.env.UI_ADMIN_URL ?? 'http://localhost:5173';
export const LANDING_URL = process.env.UI_LANDING_URL ?? 'http://localhost:5174';
export const API_URL = process.env.UI_API_URL ?? 'http://localhost:5080/api/v1';
export const DEMO_PASSWORD = process.env.UI_DEMO_PASSWORD ?? 'Demo123!';

export type Role = 'owner' | 'admin' | 'manager' | 'waiter' | 'cook' | 'cashier' | 'stock' | 'superadmin';

export const USERS: Record<Role, string> = {
  owner: 'owner@demo.respos.uz',
  admin: 'admin@demo.respos.uz',
  manager: 'manager@demo.respos.uz',
  waiter: 'waiter@demo.respos.uz',
  cook: 'cook@demo.respos.uz',
  cashier: 'cashier@demo.respos.uz',
  stock: 'stock@demo.respos.uz',
  superadmin: 'superadmin@respos.uz',
};

/** Workspace path each role lands on after login (see respos-admin/src/app/navigation/workspaces.ts). */
export const HOME: Record<Role, string> = {
  owner: '/admin',
  admin: '/admin',
  manager: '/admin',
  waiter: '/waiter',
  cook: '/kitchen',
  cashier: '/cashier',
  stock: '/stock',
  superadmin: '/platform',
};

export const SCREENSHOT_DIR = new URL('../../../docs/design/assets/screenshots/', import.meta.url);

/** Matches the role's workspace URL (`/admin`, `/admin/...`, `/admin?x`). */
export const homeUrl = (role: Role) => new RegExp(`${HOME[role]}(?:[/?#]|$)`);
