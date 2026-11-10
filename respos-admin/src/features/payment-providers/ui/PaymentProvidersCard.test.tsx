import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { PaymentProviderDto } from '@/entities/billing/billing.types';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { PaymentProvidersCard } from './PaymentProvidersCard';

const auth = makeAuth(makeUser({ permissions: ['settings.manage'] }));
const base = { callbackPath: '/cb', isImplemented: true, isConfigured: true, isEnabled: false, isAvailable: false };
const providers: PaymentProviderDto[] = [
  { ...base, code: 'payme', status: 'test' },
  { ...base, code: 'click', status: 'not_connected', isConfigured: false },
  { ...base, code: 'uzum', status: 'not_connected', isImplemented: false, isConfigured: false },
];

describe('PaymentProvidersCard', () => {
  it('shows honest statuses and enables only configured providers for the branch', async () => {
    let put: unknown = null;
    server.use(
      http.get(api('/payments/providers'), () => HttpResponse.json(providers)),
      http.get(api('/payments/fiscal'), () => HttpResponse.json({ code: 'none', status: 'not_connected' })),
      http.put(api('/payments/providers/payme'), async ({ request }) => {
        put = await request.json();
        return HttpResponse.json(providers.map((p) => (p.code === 'payme' ? { ...p, isEnabled: true, isAvailable: true } : p)));
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<PaymentProvidersCard />, { auth });

    const payme = await screen.findByTestId('provider-payme');
    expect(within(payme).getByText('Тестовый режим')).toBeInTheDocument();
    expect(within(screen.getByTestId('provider-click')).getByRole('switch')).toBeDisabled();
    expect(within(screen.getByTestId('provider-uzum')).getByText(/Адаптер не реализован/)).toBeInTheDocument();
    expect(await screen.findByText('Фискальный адаптер: none')).toBeInTheDocument();

    await user.click(within(payme).getByRole('switch'));

    await waitFor(() => expect(put).toEqual({ isEnabled: true }));
    await waitFor(() => expect(within(screen.getByTestId('provider-payme')).getByRole('switch')).toBeChecked());
  });
});
