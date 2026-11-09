import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useLocation, useRoutes, type Location, type RouteObject } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '@/shared/hooks/use-auth';
import { BranchContext } from '@/shared/hooks/use-current-branch';
import { i18n } from '@/shared/i18n';
import type { MeDto } from '@/shared/types/api-response';
import { ToastProvider } from '@/shared/ui';

export function makeUser(overrides: Partial<MeDto> = {}): MeDto {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'owner@demo.respos.uz',
    fullName: 'Demo Owner',
    preferredLanguage: 'ru',
    isPlatformAdmin: false,
    currentOrganization: { id: 'org-1', name: 'Demo', currency: 'UZS', defaultLanguage: 'ru' },
    organizations: [{ id: 'org-1', name: 'Demo' }],
    roles: [],
    permissions: [],
    branches: [{ id: 'branch-1', name: 'Центр', timezone: 'Asia/Tashkent' }],
    ...overrides,
  };
}

export function makeAuth(user: MeDto | null, overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: user ? 'authenticated' : 'unauthenticated',
    user,
    login: async () => user as MeDto,
    logout: async () => undefined,
    switchOrganization: async () => undefined,
    reloadUser: async () => undefined,
    ...overrides,
  };
}

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
}

interface ProvidersOptions {
  auth?: AuthContextValue;
  queryClient?: QueryClient;
}

function Providers({ auth, queryClient, children }: ProvidersOptions & { children: ReactNode }) {
  const authValue = auth ?? makeAuth(makeUser());
  const branches = authValue.user?.branches ?? [];
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient ?? createTestQueryClient()}>
        <ToastProvider>
          <AuthContext.Provider value={authValue}>
            <BranchContext.Provider value={{ branch: branches[0] ?? null, branches, setBranch: () => undefined }}>
              {children}
            </BranchContext.Provider>
          </AuthContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

/** Render a component with app providers and a MemoryRouter. */
export function renderWithProviders(ui: ReactElement, options: ProvidersOptions & { route?: string } & RenderOptions = {}) {
  const { auth, queryClient, route = '/', ...rest } = options;
  return render(
    <Providers auth={auth} queryClient={queryClient}>
      <MemoryRouter initialEntries={[route]} future={ROUTER_FUTURE}>{ui}</MemoryRouter>
    </Providers>,
    rest,
  );
}

function RouteTree({ routes, onLocation }: { routes: RouteObject[]; onLocation: (location: Location) => void }) {
  const location = useLocation();
  onLocation(location);
  return useRoutes(routes);
}

/**
 * Render a route tree (guards, redirects) at `route`. Uses a non-data MemoryRouter: the data router
 * builds fetch Requests whose AbortSignal is incompatible with jsdom.
 */
export function renderRoutes(routes: RouteObject[], options: ProvidersOptions & { route: string }) {
  const current: { location: Location | null } = { location: null };
  const result = render(
    <Providers auth={options.auth} queryClient={options.queryClient}>
      <MemoryRouter initialEntries={[options.route]} future={ROUTER_FUTURE}>
        <RouteTree routes={routes} onLocation={(location) => (current.location = location)} />
      </MemoryRouter>
    </Providers>,
  );
  return { ...result, getLocation: () => current.location };
}
