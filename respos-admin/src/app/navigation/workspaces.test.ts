import { describe, expect, it } from 'vitest';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { makeUser } from '@/test/test-utils';
import { availableWorkspaces, resolveDefaultWorkspace } from './workspaces';

const ALL_ORG = [
  P.reports.read, P.users.read, P.roles.read, P.branches.manage, P.settings.manage, P.menu.manage,
  P.orders.create, P.kitchen.read, P.kitchen.statusUpdate, P.payments.create, P.cashShifts.open, P.inventory.read,
];

const cases: [string, Parameters<typeof makeUser>[0], string | null][] = [
  ['owner', { roles: ['owner'], permissions: ALL_ORG }, '/admin'],
  ['manager', { roles: ['manager'], permissions: [P.reports.read, P.orders.create, P.kitchen.read] }, '/admin'],
  ['cook', { roles: ['cook'], permissions: [P.kitchen.read, P.kitchen.statusUpdate, P.menu.read] }, '/kitchen'],
  ['waiter', { roles: ['waiter'], permissions: [P.orders.create, P.tables.read, P.kitchen.read] }, '/waiter'],
  ['cashier', { roles: ['cashier'], permissions: [P.payments.create, P.cashShifts.open, P.orders.read] }, '/cashier'],
  ['stockkeeper', { roles: ['stockkeeper'], permissions: [P.inventory.read, P.inventory.adjust] }, '/stock'],
  ['accountant', { roles: ['accountant'], permissions: [P.reports.read, P.audit.read] }, '/admin'],
  ['custom role with kitchen rights', { roles: ['grill'], permissions: [P.kitchen.read, P.kitchen.statusUpdate] }, '/kitchen'],
  ['platform admin without org', { isPlatformAdmin: true, currentOrganization: null, permissions: [] }, '/platform'],
  ['user without any access', { roles: [], permissions: [P.notifications.read] }, null],
];

describe('resolveDefaultWorkspace', () => {
  it.each(cases)('%s → %s', (_name, overrides, expected) => {
    expect(resolveDefaultWorkspace(makeUser(overrides))?.path ?? null).toBe(expected);
  });

  it('platform admin with an org lands in the org workspace and can still switch to platform', () => {
    const user = makeUser({ isPlatformAdmin: true, roles: ['owner'], permissions: ALL_ORG });
    expect(resolveDefaultWorkspace(user)?.id).toBe('admin');
    expect(availableWorkspaces(user).map((w) => w.id)).toContain('platform');
  });

  it('operational roles do not see the admin workspace', () => {
    const cook = makeUser({ roles: ['cook'], permissions: [P.kitchen.read, P.menu.read] });
    expect(availableWorkspaces(cook).map((w) => w.id)).toEqual(['kitchen']);
  });
});
