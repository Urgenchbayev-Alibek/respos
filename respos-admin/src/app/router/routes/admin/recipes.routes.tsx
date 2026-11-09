import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

export const routeModule = defineRoutes('admin', [
  {
    path: ROUTES.admin.recipes,
    element: lazyPage(() => import('@/pages/stock/recipes/RecipesPage').then((m) => ({ default: m.RecipesPage })), {
      anyOf: [P.recipes.read],
    }),
  },
]);
