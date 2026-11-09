import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderRoutes } from '@/test/test-utils';
import { routeModule } from './platform.routes';

const routes = [{ path: '/platform', children: routeModule.routes }];

describe('platform routes', () => {
  it('are forbidden for a non-platform user even with all org permissions', async () => {
    const owner = makeUser({ roles: ['owner'], permissions: [...Object.values(P.inventory), P.reports.read, P.users.read] });
    renderRoutes(routes, { route: '/platform', auth: makeAuth(owner) });
    expect(await screen.findByText('403')).toBeInTheDocument();
  });

  it('forbid platform sub-pages too', async () => {
    renderRoutes(routes, { route: '/platform/demo-requests', auth: makeAuth(makeUser({ permissions: [P.audit.read] })) });
    expect(await screen.findByText('403')).toBeInTheDocument();
  });

  it('open the organizations list for a platform admin', async () => {
    server.use(http.get(api('/platform/organizations'), () => HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0 })));
    const admin = makeUser({ isPlatformAdmin: true, currentOrganization: null, permissions: [] });
    renderRoutes(routes, { route: '/platform', auth: makeAuth(admin) });
    expect(await screen.findByRole('heading', { name: 'Организации' })).toBeInTheDocument();
    expect(await screen.findByText('Организаций нет')).toBeInTheDocument();
  });
});
