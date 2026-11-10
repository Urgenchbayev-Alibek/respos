import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { TimeClockButton } from './TimeClockButton';

const openEntry = {
  id: 'e1', userId: 'u1', userName: 'Demo', branchId: 'branch-1', clockInAt: '2026-11-10T04:00:00Z', clockOutAt: null,
  breakMinutes: 0, workedMinutes: 125, isOpen: true, source: 'self', note: null, editedBy: null, editedByName: null,
  editedAt: null, editReason: null,
};

describe('TimeClockButton', () => {
  it('is hidden without staff.timeclock', () => {
    const { container } = renderWithProviders(<TimeClockButton />, { auth: makeAuth(makeUser()) });
    expect(container).toBeEmptyDOMElement();
  });

  it('clocks in', async () => {
    let clockedIn = false;
    server.use(
      http.get(api('/staff/time-clock/me'), () =>
        HttpResponse.json({ openEntry: clockedIn ? openEntry : null, todayWorkedMinutes: 0 }),
      ),
      http.post(api('/staff/time-clock/clock-in'), () => {
        clockedIn = true;
        return HttpResponse.json(openEntry, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<TimeClockButton />, { auth: makeAuth(makeUser({ permissions: [PERMISSIONS.staff.timeClock] })) });

    await user.click(await screen.findByRole('button', { name: 'Начать смену' }));
    await waitFor(() => expect(clockedIn).toBe(true));
    expect(await screen.findByRole('button', { name: /На смене с .* · 2:05/ })).toBeInTheDocument();
  });

  it('clocks out with a break', async () => {
    let body: unknown = null;
    server.use(
      http.get(api('/staff/time-clock/me'), () => HttpResponse.json({ openEntry, todayWorkedMinutes: 125 })),
      http.post(api('/staff/time-clock/clock-out'), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...openEntry, isOpen: false, clockOutAt: '2026-11-10T06:05:00Z' });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<TimeClockButton />, { auth: makeAuth(makeUser({ permissions: [PERMISSIONS.staff.timeClock] })) });

    await user.click(await screen.findByRole('button', { name: /На смене/ }));
    await user.type(screen.getByLabelText('Перерыв, мин'), '15');
    await user.click(screen.getByRole('button', { name: 'Закончить смену' }));
    await waitFor(() => expect(body).toEqual({ breakMinutes: 15 }));
  });
});
