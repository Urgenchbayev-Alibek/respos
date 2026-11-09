import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { ROUTES } from '@/shared/constants/routes';

export const routeModule = defineRoutes('account', [
  { path: ROUTES.profile, element: lazyPage(() => import('@/pages/profile/ProfilePage').then((m) => ({ default: m.ProfilePage }))) },
]);
