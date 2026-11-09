import type { PermissionDto } from '@/entities/role/role.types';
import { isPlatformPermission, PERMISSIONS } from '@/shared/constants/permissions';

export interface PermissionGroup {
  module: string;
  permissions: PermissionDto[];
}

function flatten(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (node && typeof node === 'object') return Object.values(node).flatMap(flatten);
  return [];
}

/** Org permission codes from the frontend catalog (fallback when GET /permissions is unavailable). */
export const ORG_PERMISSION_CODES: string[] = flatten(PERMISSIONS).filter((code) => !isPlatformPermission(code));

export function moduleOf(code: string): string {
  return code.split('.')[0] ?? code;
}

/** Groups by `module` (server) keeping catalog order; platform permissions are never assignable to org roles. */
export function groupPermissions(catalog: PermissionDto[] | undefined): PermissionGroup[] {
  const source: PermissionDto[] =
    catalog && catalog.length > 0
      ? catalog
      : ORG_PERMISSION_CODES.map((code) => ({ code, module: moduleOf(code), description: '' }));
  const groups = new Map<string, PermissionDto[]>();
  source
    .filter((permission) => !isPlatformPermission(permission.code))
    .forEach((permission) => {
      const module = permission.module || moduleOf(permission.code);
      groups.set(module, [...(groups.get(module) ?? []), permission]);
    });
  return [...groups.entries()].map(([module, permissions]) => ({ module, permissions }));
}
