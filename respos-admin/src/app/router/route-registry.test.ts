import { matchRoutes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ADMIN_NAV } from '@/app/navigation/admin.nav';
import { CASHIER_NAV, PLATFORM_NAV, STOCK_NAV, WAITER_NAV } from '@/app/navigation/workspace.nav';
import { buildRoutes } from './router';

const routes = buildRoutes();

describe('route registry', () => {
  it('admin sidebar has the 18 sections of spec §5.1', () => {
    expect(ADMIN_NAV).toHaveLength(18);
  });

  it.each([...ADMIN_NAV, ...WAITER_NAV, ...CASHIER_NAV, ...STOCK_NAV, ...PLATFORM_NAV].map((item) => [item.path]))(
    'every nav item resolves to a registered page: %s',
    (path) => {
      const matches = matchRoutes(routes, path) ?? [];
      const leaf = matches[matches.length - 1];
      expect(leaf?.route.path).not.toBe('*');
      expect(leaf).toBeDefined();
    },
  );

  it.each(['/login', '/forgot-password', '/reset-password', '/accept-invitation', '/profile', '/kitchen', '/admin/roles/new'])(
    'registers %s',
    (path) => {
      const leaf = (matchRoutes(routes, path) ?? []).at(-1);
      expect(leaf?.route.path).not.toBe('*');
    },
  );

  it('unknown paths fall through to 404', () => {
    expect((matchRoutes(routes, '/admin/nope') ?? []).at(-1)?.route.path).toBe('*');
  });
});
