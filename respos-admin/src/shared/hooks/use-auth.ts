import { createContext, useContext } from 'react';
import type { MeDto } from '@/shared/types/api-response';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface LoginInput {
  email: string;
  password: string;
  organizationId?: string;
}

/** PIN quick login on a registered shared device (ADR-0014). */
export interface PinLoginInput {
  userId: string;
  pin: string;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: MeDto | null;
  login: (input: LoginInput) => Promise<MeDto>;
  /** Shared device: `POST /auth/pin-login` (device cookie) → branch-scoped session. */
  pinLogin: (input: PinLoginInput) => Promise<MeDto>;
  logout: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  /** Re-reads `GET /auth/me` (after profile/role changes). */
  reloadUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Session state; provided by app/providers/AuthProvider. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

/** Shortcut for components that render only when signed in (inside RequireAuth). */
export function useCurrentUser(): MeDto {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser used outside an authenticated route');
  return user;
}
