import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { sharedDeviceFlag } from '@/features/shared-device/model/shared-device';
import { apiErrorFromProblem } from '@/shared/api/api-error';
import { api, http, HttpResponse, problem, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { DeviceLockPage } from './DeviceLockPage';

const device = { id: 'd1', name: 'Hall tablet', branchId: 'branch-1', branchName: 'Центр', organizationName: 'Demo' };

function mockDevice() {
  server.use(
    http.get(api('/auth/device'), () => HttpResponse.json(device)),
    http.get(api('/auth/device/staff'), () => HttpResponse.json([{ id: 'u1', fullName: 'Aziz Karimov' }])),
  );
}

async function enterPin(user: ReturnType<typeof userEvent.setup>, pin: string) {
  for (const digit of pin) await user.click(screen.getByRole('button', { name: digit }));
}

describe('DeviceLockPage', () => {
  it('shows staff avatars and signs in with the PIN keypad', async () => {
    mockDevice();
    const pinLogin = vi.fn().mockResolvedValue(makeUser());
    const user = userEvent.setup();
    renderWithProviders(<DeviceLockPage />, { auth: makeAuth(null, { pinLogin }) });

    await user.click(await screen.findByRole('button', { name: /Aziz Karimov/ }));
    const submit = screen.getByRole('button', { name: 'Войти' });
    expect(submit).toBeDisabled();
    await enterPin(user, '2580');
    await user.click(submit);

    await waitFor(() => expect(pinLogin).toHaveBeenCalledWith({ userId: 'u1', pin: '2580' }));
  });

  it('shows a localized error for a wrong PIN and clears the input', async () => {
    mockDevice();
    const pinLogin = vi.fn().mockRejectedValue(apiErrorFromProblem(401, { code: 'pin.invalid', title: 'pin.invalid' }));
    const user = userEvent.setup();
    renderWithProviders(<DeviceLockPage />, { auth: makeAuth(null, { pinLogin }) });

    await user.click(await screen.findByRole('button', { name: /Aziz Karimov/ }));
    await enterPin(user, '1357');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Неверный PIN')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Введено цифр: 0' })).toBeInTheDocument();
  });

  it('redirects to the password login when this browser is not a registered device', async () => {
    sharedDeviceFlag.set();
    server.use(http.get(api('/auth/device'), () => problem(401, 'device.invalid')));
    renderWithProviders(<DeviceLockPage />, { auth: makeAuth(null) });
    await waitFor(() => expect(sharedDeviceFlag.isSet()).toBe(false));
    expect(screen.queryByText('Кто работает?')).not.toBeInTheDocument();
  });
});
