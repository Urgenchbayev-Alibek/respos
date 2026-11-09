import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { ROUTES } from '@/shared/constants/routes';

export const routeModule = defineRoutes('public', [
  { path: ROUTES.login, element: lazyPage(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage }))) },
  {
    path: ROUTES.forgotPassword,
    element: lazyPage(() => import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))),
  },
  {
    path: ROUTES.resetPassword,
    element: lazyPage(() => import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))),
  },
  {
    path: ROUTES.acceptInvitation,
    element: lazyPage(() => import('@/pages/auth/AcceptInvitationPage').then((m) => ({ default: m.AcceptInvitationPage }))),
  },
]);
