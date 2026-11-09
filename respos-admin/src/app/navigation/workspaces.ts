import { ChefHat, LayoutDashboard, Package, ShieldCheck, UtensilsCrossed, Wallet, type LucideIcon } from 'lucide-react';
import { PERMISSIONS as P, SYSTEM_ROLES as R, type Permission } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';
import { hasAnyPermission } from '@/shared/hooks/use-permissions';
import type { MeDto } from '@/shared/types/api-response';

export type WorkspaceId = 'admin' | 'waiter' | 'kitchen' | 'cashier' | 'stock' | 'platform';

export interface WorkspaceDef {
  id: WorkspaceId;
  path: string;
  labelKey: string;
  icon: LucideIcon;
  /** Access if the user has ANY of these org permissions. */
  anyOf: readonly Permission[];
  /** Platform workspace: requires `isPlatformAdmin`, no org needed. */
  platformOnly?: boolean;
}

/** Management permissions that open the Admin Panel (operational read perms alone do not). */
const ADMIN_ACCESS: readonly Permission[] = [
  P.reports.read,
  P.users.read,
  P.roles.read,
  P.branches.manage,
  P.settings.manage,
  P.menu.manage,
  P.tables.manage,
  P.kitchen.stationsManage,
  P.audit.read,
];

export const WORKSPACES: readonly WorkspaceDef[] = [
  { id: 'admin', path: ROUTES.admin.root, labelKey: 'nav:workspaces.admin', icon: LayoutDashboard, anyOf: ADMIN_ACCESS },
  { id: 'waiter', path: ROUTES.waiter.root, labelKey: 'nav:workspaces.waiter', icon: UtensilsCrossed, anyOf: [P.orders.create] },
  { id: 'kitchen', path: ROUTES.kitchen.root, labelKey: 'nav:workspaces.kitchen', icon: ChefHat, anyOf: [P.kitchen.read] },
  { id: 'cashier', path: ROUTES.cashier.root, labelKey: 'nav:workspaces.cashier', icon: Wallet, anyOf: [P.payments.create, P.cashShifts.open] },
  { id: 'stock', path: ROUTES.stock.root, labelKey: 'nav:workspaces.stock', icon: Package, anyOf: [P.inventory.read] },
  { id: 'platform', path: ROUTES.platform.root, labelKey: 'nav:workspaces.platform', icon: ShieldCheck, anyOf: [], platformOnly: true },
];

export function getWorkspace(id: WorkspaceId): WorkspaceDef {
  const workspace = WORKSPACES.find((item) => item.id === id);
  if (!workspace) throw new Error(`Unknown workspace ${id}`);
  return workspace;
}

export function canAccessWorkspace(user: MeDto | null, workspace: WorkspaceDef): boolean {
  if (!user) return false;
  if (workspace.platformOnly) return user.isPlatformAdmin;
  if (!user.currentOrganization) return false;
  return workspace.anyOf.length > 0 && hasAnyPermission(user, workspace.anyOf);
}

export function availableWorkspaces(user: MeDto | null): WorkspaceDef[] {
  return WORKSPACES.filter((workspace) => canAccessWorkspace(user, workspace));
}

/** Role code → preferred workspace (first match wins; management roles go to admin). */
const ROLE_PREFERENCE: readonly [string, WorkspaceId][] = [
  [R.owner, 'admin'],
  [R.admin, 'admin'],
  [R.manager, 'admin'],
  [R.accountant, 'admin'],
  [R.cook, 'kitchen'],
  [R.waiter, 'waiter'],
  [R.cashier, 'cashier'],
  [R.stockkeeper, 'stock'],
];

/** Custom roles: guess by the strongest operational permission. */
const PERMISSION_PREFERENCE: readonly [Permission, WorkspaceId][] = [
  [P.kitchen.statusUpdate, 'kitchen'],
  [P.orders.create, 'waiter'],
  [P.payments.create, 'cashier'],
  [P.inventory.adjust, 'stock'],
];

/**
 * Where `/` sends a user after login: cook→/kitchen, waiter→/waiter, cashier→/cashier, stockkeeper→/stock,
 * platform admin without org→/platform, others→/admin. Returns null if no workspace is accessible.
 */
export function resolveDefaultWorkspace(user: MeDto | null): WorkspaceDef | null {
  if (!user) return null;
  const accessible = availableWorkspaces(user);
  const pick = (id: WorkspaceId) => accessible.find((workspace) => workspace.id === id);

  if (user.isPlatformAdmin && !user.currentOrganization) return pick('platform') ?? null;
  for (const [role, id] of ROLE_PREFERENCE) {
    if (user.roles.includes(role) && pick(id)) return pick(id) ?? null;
  }
  if (pick('admin')) return pick('admin') ?? null;
  for (const [permission, id] of PERMISSION_PREFERENCE) {
    if (user.permissions.includes(permission) && pick(id)) return pick(id) ?? null;
  }
  return accessible[0] ?? null;
}
