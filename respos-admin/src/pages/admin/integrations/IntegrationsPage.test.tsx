import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { IntegrationDto } from '@/entities/integration/integration.types';
import { api, http, HttpResponse, problem, server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/test-utils';
import { IntegrationsPage } from './IntegrationsPage';

const telegram: IntegrationDto<'telegram'> = {
  type: 'telegram',
  isEnabled: true,
  status: 'connected',
  isConfigured: true,
  config: {
    botToken: '****WXYZ',
    chatIds: ['-1001'],
    dailySummaryEnabled: true,
    dailySummaryTime: '21:00',
    lowStockEnabled: true,
    bigRefundEnabled: true,
    bigRefundThreshold: 500000,
    onlineReservationEnabled: true,
    shiftDifferenceEnabled: true,
  },
  lastSuccessAt: '2026-11-10T08:00:00Z',
  lastErrorAt: null,
  lastError: null,
  updatedAt: '2026-11-10T08:00:00Z',
};

const sms: IntegrationDto<'sms_eskiz'> = {
  type: 'sms_eskiz',
  isEnabled: false,
  status: 'not_configured',
  isConfigured: false,
  config: { email: null, password: null, from: '4546', reservationConfirmationEnabled: true },
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  updatedAt: null,
};

const smtp: IntegrationDto<'smtp'> = {
  type: 'smtp',
  isEnabled: true,
  status: 'error',
  isConfigured: true,
  config: { host: 'smtp.mail.uz', port: 587, useSsl: false, username: 'u', password: '****', fromEmail: 'a@mail.uz', fromName: null },
  lastSuccessAt: null,
  lastErrorAt: '2026-11-10T09:00:00Z',
  lastError: 'SMTP authentication failed',
  updatedAt: '2026-11-10T09:00:00Z',
};

function mockList() {
  server.use(http.get(api('/integrations'), () => HttpResponse.json([telegram, sms, smtp])));
}

describe('IntegrationsPage', () => {
  it('shows a card per integration with honest statuses and masked secrets', async () => {
    mockList();
    renderWithProviders(<IntegrationsPage />);

    const tg = await screen.findByTestId('integration-telegram');
    expect(within(tg).getByText('Подключено')).toBeInTheDocument();
    expect(within(tg).getByLabelText(/Токен бота/)).toHaveValue('****WXYZ');
    expect(within(tg).getByLabelText(/Токен бота/)).toHaveAttribute('type', 'password');
    expect(within(screen.getByTestId('integration-sms_eskiz')).getByText('Не подключено')).toBeInTheDocument();
    const mail = screen.getByTestId('integration-smtp');
    expect(within(mail).getByText('Ошибка')).toBeInTheDocument();
    expect(within(mail).getByText(/SMTP authentication failed/)).toBeInTheDocument();
  });

  it('saves the form and sends the masked secret back unchanged', async () => {
    mockList();
    let body: unknown = null;
    server.use(http.put(api('/integrations/telegram'), async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(telegram);
    }));
    renderWithProviders(<IntegrationsPage />);
    const tg = await screen.findByTestId('integration-telegram');
    const chats = within(tg).getByLabelText(/ID чатов/);
    await userEvent.clear(chats);
    await userEvent.type(chats, '-1001, -1002');
    await userEvent.click(within(tg).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ isEnabled: true, config: { botToken: '****WXYZ', chatIds: ['-1001', '-1002'], dailySummaryTime: '21:00' } });
  });

  it('requires a bot token when telegram is enabled', async () => {
    server.use(http.get(api('/integrations'), () => HttpResponse.json([{ ...telegram, config: { ...telegram.config, botToken: null } }, sms, smtp])));
    renderWithProviders(<IntegrationsPage />);
    const tg = await screen.findByTestId('integration-telegram');
    await userEvent.type(within(tg).getByLabelText(/ID чатов/), '1');
    await userEvent.click(within(tg).getByRole('button', { name: 'Сохранить' }));
    expect(await within(tg).findByText('Обязательное поле')).toBeInTheDocument();
  });

  it('sends a test message and shows the provider error', async () => {
    mockList();
    server.use(http.post(api('/integrations/telegram/test'), () =>
      HttpResponse.json({ success: false, error: 'Telegram HTTP 400: chat not found', integration: telegram })));
    renderWithProviders(<IntegrationsPage />);
    const tg = await screen.findByTestId('integration-telegram');
    await userEvent.click(within(tg).getByRole('button', { name: 'Отправить тест' }));
    expect(await within(tg).findByText(/chat not found/)).toBeInTheDocument();
  });

  it('disables the test button until the integration is configured', async () => {
    mockList();
    renderWithProviders(<IntegrationsPage />);
    const card = await screen.findByTestId('integration-sms_eskiz');
    expect(within(card).getByRole('button', { name: 'Отправить тест' })).toBeDisabled();
  });

  it('shows an error state when the list fails', async () => {
    server.use(http.get(api('/integrations'), () => problem(500, 'server.error')));
    renderWithProviders(<IntegrationsPage />);
    expect(await screen.findByRole('button', { name: /Повторить/ })).toBeInTheDocument();
  });
});
