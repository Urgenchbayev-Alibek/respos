import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { sessionStore } from '@/shared/api/session-store';
import { useAuth } from '@/shared/hooks/use-auth';
import { api, http, HttpResponse, problem, server } from '@/test/msw-server';
import { createTestQueryClient, makeUser } from '@/test/test-utils';
import { AuthProvider } from './AuthProvider';

function Probe() {
  const { status, user } = useAuth();
  return <p>{`${status}:${user?.email ?? '-'}`}</p>;
}

function renderProvider() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('AuthProvider', () => {
  it('restores the session from the refresh cookie on start (token kept in memory only)', async () => {
    const user = makeUser();
    server.use(
      http.post(api('/auth/refresh'), () =>
        HttpResponse.json({ accessToken: 'restored', expiresAt: new Date(Date.now() + 900_000).toISOString(), user }),
      ),
    );
    renderProvider();
    expect(await screen.findByText(`authenticated:${user.email}`)).toBeInTheDocument();
    expect(sessionStore.getAccessToken()).toBe('restored');
    expect(JSON.stringify(localStorage)).not.toContain('restored');
  });

  it('becomes unauthenticated when there is no valid refresh cookie', async () => {
    server.use(http.post(api('/auth/refresh'), () => problem(401, 'auth.invalid_token')));
    renderProvider();
    await waitFor(() => expect(screen.getByText('unauthenticated:-')).toBeInTheDocument());
  });
});
