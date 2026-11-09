import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { ReportsPage } from './ReportsPage';

const auth = makeAuth(makeUser({ permissions: [P.reports.read] }));

beforeAll(() => {
  // recharts' ResponsiveContainer needs ResizeObserver (absent in jsdom).
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('ReportsPage', () => {
  it('renders server KPIs, the revenue table view and sends the period', async () => {
    const captured: { params?: URLSearchParams } = {};
    server.use(
      http.get(api('/reports/sales'), ({ request }) => {
        captured.params = new URL(request.url).searchParams;
        return HttpResponse.json({
          totalRevenue: 38400000,
          ordersCount: 812,
          averageCheck: 47300,
          byDay: [
            { date: '2026-11-09', revenue: 4100000, orders: 90 },
            { date: '2026-11-10', revenue: 3900000, orders: 85 },
          ],
        });
      }),
    );
    renderWithProviders(<ReportsPage />, { auth });

    expect(await screen.findByText('812')).toBeInTheDocument();
    expect(captured.params?.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(captured.params?.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.getByRole('img', { name: 'График выручки по дням' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Показать таблицей' }));
    expect(screen.getByRole('table', { name: 'Выручка по дням' })).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Экспорт CSV/ })).toBeInTheDocument();
  });

  it('shows the empty state for a period without sales', async () => {
    server.use(
      http.get(api('/reports/sales'), () => HttpResponse.json({ totalRevenue: 0, ordersCount: 0, averageCheck: 0, byDay: [] })),
      http.get(api('/reports/top-items'), () => HttpResponse.json([])),
    );
    renderWithProviders(<ReportsPage />, { auth });
    expect(await screen.findByText('Нет данных за период')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Блюда' }));
    expect(await screen.findByText('Нет данных за период')).toBeInTheDocument();
  });

  it('validates a custom period', async () => {
    server.use(http.get(api('/reports/sales'), () => HttpResponse.json({ totalRevenue: 0, ordersCount: 0, averageCheck: 0, byDay: [] })));
    renderWithProviders(<ReportsPage />, { auth });
    await userEvent.click(screen.getByRole('button', { name: 'Свой период' }));
    const from = screen.getByLabelText('С даты');
    await userEvent.clear(from);
    expect(await screen.findByText(/Укажите корректный период/)).toBeInTheDocument();
  });
});
