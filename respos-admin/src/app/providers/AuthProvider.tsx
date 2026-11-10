import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { apiClient, refreshSession } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import { sessionStore } from '@/shared/api/session-store';
import { AuthContext, type AuthContextValue, type AuthStatus, type LoginInput } from '@/shared/hooks/use-auth';
import { hasStoredLanguage, i18n } from '@/shared/i18n';
import { hubManager } from '@/shared/realtime';
import type { AuthResponse, MeDto } from '@/shared/types/api-response';

/** Refresh the access token this long before it expires (keeps KDS / hub alive without REST traffic). */
const REFRESH_AHEAD_MS = 60_000;
const MIN_REFRESH_DELAY_MS = 5_000;

interface State {
  status: AuthStatus;
  user: MeDto | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>({ status: 'loading', user: null });
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSession = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    sessionStore.setAccessToken(null);
    queryClient.clear();
    void hubManager.stop();
    setState({ status: 'unauthenticated', user: null });
  }, [queryClient]);

  const applySession = useCallback((auth: AuthResponse) => {
    sessionStore.setAccessToken(auth.accessToken);
    if (!hasStoredLanguage() && auth.user.preferredLanguage !== i18n.language) {
      void i18n.changeLanguage(auth.user.preferredLanguage);
    }
    setState({ status: 'authenticated', user: auth.user });

    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const delay = new Date(auth.expiresAt).getTime() - Date.now() - REFRESH_AHEAD_MS;
    if (Number.isFinite(delay)) {
      refreshTimer.current = setTimeout(() => {
        void refreshSession().then(
          (next) => (next?.user ? applySession(next) : undefined),
          // Server unreachable even after backoff: keep the session; the next 401 refreshes again.
          (error: unknown) => console.warn('[auth] background refresh failed; session kept', error),
        );
      }, Math.max(MIN_REFRESH_DELAY_MS, delay));
    }
  }, []);

  // Restore session on start: access token is memory-only, the refresh cookie survives reloads.
  useEffect(() => {
    let active = true;
    void refreshSession()
      .catch((error: unknown) => {
        console.warn('[auth] session restore failed (server unreachable)', error);
        return null;
      })
      .then((auth) => {
        if (!active) return;
        if (auth?.user) applySession(auth);
        else setState({ status: 'unauthenticated', user: null });
      });
    return () => {
      active = false;
    };
  }, [applySession]);

  useEffect(() => sessionStore.onSessionExpired(clearSession), [clearSession]);
  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      const auth = await apiClient.post<AuthResponse>(ENDPOINTS.auth.login, input, { skipAuth: true, branchId: null });
      queryClient.clear();
      applySession(auth);
      return auth.user;
    },
    [applySession, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post(ENDPOINTS.auth.logout, undefined, { branchId: null });
    } catch (error) {
      console.warn('[auth] logout request failed; clearing local session anyway', error);
    }
    clearSession();
  }, [clearSession]);

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      const auth = await apiClient.post<AuthResponse>(ENDPOINTS.auth.switchOrganization, { organizationId }, { branchId: null });
      sessionStore.setBranchId(null);
      queryClient.clear();
      applySession(auth);
    },
    [applySession, queryClient],
  );

  const reloadUser = useCallback(async () => {
    const user = await apiClient.get<MeDto>(ENDPOINTS.auth.me);
    setState({ status: 'authenticated', user });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, switchOrganization, reloadUser }),
    [state, login, logout, switchOrganization, reloadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
