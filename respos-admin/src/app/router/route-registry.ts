import type { RouteObject } from 'react-router-dom';
import type { RouteModule, RouteScope } from './route-module';

/**
 * Every `routes/**\/*.routes.tsx` exporting `routeModule` is registered automatically.
 * Adding a section = adding one route file; no edit here.
 */
const modules = import.meta.glob<{ routeModule: RouteModule }>('./routes/**/*.routes.tsx', { eager: true });

export function collectRoutes(): Record<RouteScope, RouteObject[]> {
  const byScope: Record<RouteScope, RouteObject[]> = {
    public: [],
    account: [],
    admin: [],
    waiter: [],
    kitchen: [],
    cashier: [],
    stock: [],
    platform: [],
  };
  Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([path, module]) => {
      if (!module.routeModule) throw new Error(`${path} must export \`routeModule\` (use defineRoutes)`);
      byScope[module.routeModule.scope].push(...module.routeModule.routes);
    });
  return byScope;
}
