import { screen } from '@testing-library/react';
import type { RouteObject } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HomeRedirect } from '@/app/router/HomeRedirect';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { makeAuth, makeUser, renderRoutes } from '@/test/test-utils';
import { RequireAuth } from './RequireAuth';
import { RequirePermission } from './RequirePermission';
import { RequireWorkspace } from './RequireWorkspace';

const routes: RouteObject[] = [
  { path: '/login', element: <p>login page</p> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <HomeRedirect /> },
      { path: '/admin', element: <RequireWorkspace workspace="admin"><p>admin home</p></RequireWorkspace> },
      { path: '/kitchen', element: <RequireWorkspace workspace="kitchen"><p>kitchen board</p></RequireWorkspace> },
      { path: '/waiter', element: <p>waiter home</p> },
      {
        path: '/admin/users',
        element: (
          <RequirePermission anyOf={[P.users.read]}>
            <p>users page</p>
          </RequirePermission>
        ),
      },
    ],
  },
];

describe('RequireAuth', () => {
  it('redirects anonymous users to /login', async () => {
    const { getLocation } = renderRoutes(routes, { route: '/admin/users', auth: makeAuth(null) });
    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(getLocation()?.state).toEqual({ from: '/admin/users' });
  });

  it('shows a loader while the session is being restored', () => {
    renderRoutes(routes, { route: '/admin', auth: { ...makeAuth(null), status: 'loading' } });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('RequirePermission', () => {
  it('renders the page when the permission is present', async () => {
    renderRoutes(routes, { route: '/admin/users', auth: makeAuth(makeUser({ permissions: [P.users.read] })) });
    expect(await screen.findByText('users page')).toBeInTheDocument();
  });

  it('renders 403 when the permission is missing', async () => {
    renderRoutes(routes, { route: '/admin/users', auth: makeAuth(makeUser({ permissions: [P.orders.read] })) });
    expect(await screen.findByText('403')).toBeInTheDocument();
    expect(screen.queryByText('users page')).not.toBeInTheDocument();
  });
});

describe('RequireWorkspace', () => {
  it('blocks operational roles from the admin workspace', async () => {
    const cook = makeUser({ roles: ['cook'], permissions: [P.kitchen.read, P.menu.read] });
    renderRoutes(routes, { route: '/admin', auth: makeAuth(cook) });
    expect(await screen.findByText('403')).toBeInTheDocument();
  });
});

describe('HomeRedirect', () => {
  it('sends a cook to the kitchen', async () => {
    const cook = makeUser({ roles: ['cook'], permissions: [P.kitchen.read, P.kitchen.statusUpdate] });
    const { getLocation } = renderRoutes(routes, { route: '/', auth: makeAuth(cook) });
    expect(await screen.findByText('kitchen board')).toBeInTheDocument();
    expect(getLocation()?.pathname).toBe('/kitchen');
  });

  it('sends an owner to the admin panel', async () => {
    const owner = makeUser({ roles: ['owner'], permissions: [P.reports.read, P.users.read] });
    renderRoutes(routes, { route: '/', auth: makeAuth(owner) });
    expect(await screen.findByText('admin home')).toBeInTheDocument();
  });

  it('shows 403 when the user has no workspace', async () => {
    renderRoutes(routes, { route: '/', auth: makeAuth(makeUser({ permissions: [] })) });
    expect(await screen.findByText('403')).toBeInTheDocument();
  });
});
