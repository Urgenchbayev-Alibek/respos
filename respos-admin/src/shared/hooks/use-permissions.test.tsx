import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { makeAuth, makeUser } from '@/test/test-utils';
import { AuthContext } from './use-auth';
import { hasAllPermissions, hasAnyPermission, hasPermission, usePermissions } from './use-permissions';

const waiter = makeUser({ permissions: [PERMISSIONS.orders.read, PERMISSIONS.orders.create] });

describe('hasPermission', () => {
  it('checks the effective permission list', () => {
    expect(hasPermission(waiter, PERMISSIONS.orders.create)).toBe(true);
    expect(hasPermission(waiter, PERMISSIONS.orders.cancel)).toBe(false);
    expect(hasPermission(null, PERMISSIONS.orders.read)).toBe(false);
  });

  it('grants platform permissions to platform admins only', () => {
    const platformAdmin = makeUser({ isPlatformAdmin: true, currentOrganization: null, permissions: [] });
    expect(hasPermission(platformAdmin, PERMISSIONS.platform.organizationsRead)).toBe(true);
    expect(hasPermission(platformAdmin, PERMISSIONS.users.read)).toBe(false);
    expect(hasPermission(waiter, PERMISSIONS.platform.organizationsRead)).toBe(false);
  });

  it('supports any/all combinations', () => {
    expect(hasAnyPermission(waiter, [PERMISSIONS.orders.cancel, PERMISSIONS.orders.read])).toBe(true);
    expect(hasAnyPermission(waiter, [])).toBe(true);
    expect(hasAllPermissions(waiter, [PERMISSIONS.orders.read, PERMISSIONS.orders.cancel])).toBe(false);
  });
});

describe('usePermissions', () => {
  it('reads the current user from auth context', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider value={makeAuth(waiter)}>{children}</AuthContext.Provider>
    );
    const { result } = renderHook(() => usePermissions(), { wrapper });
    expect(result.current.hasPermission(PERMISSIONS.orders.create)).toBe(true);
    expect(result.current.hasAny([PERMISSIONS.menu.manage])).toBe(false);
    expect(result.current.isPlatformAdmin).toBe(false);
  });
});
