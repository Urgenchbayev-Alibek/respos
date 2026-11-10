import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { ROUTES } from '@/shared/constants/routes';

/** Shared-device lock screen (F6, ADR-0014): anonymous; the device credential is an httpOnly cookie. */
export const routeModule = defineRoutes('public', [
  { path: ROUTES.device, element: lazyPage(() => import('@/pages/device/DeviceLockPage').then((m) => ({ default: m.DeviceLockPage }))) },
]);
