import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { api, http, HttpResponse, problem, server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/test-utils';
import { DashboardPage } from './DashboardPage';

const dashboard = {
  salesToday: 1250000,
  ordersToday: 42,
  averageCheck: 29762.5,
  activeOrders: 5,
  tablesOccupied: 7,
  tablesTotal: 20,
  topItems: [{ name: 'Плов', quantity: 12, revenue: 480000 }],
  lowStockCount: 2,
  currentShift: null,
  isDemoData: true,
};

describe('DashboardPage', () => {
  it('renders server stats and the demo badge', async () => {
    server.use(http.get(api('/dashboard'), () => HttpResponse.json(dashboard)));
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('7 из 20')).toBeInTheDocument();
    expect(screen.getByText('Плов')).toBeInTheDocument();
    expect(screen.getByText('Демо')).toBeInTheDocument();
    expect(screen.getByText('Смена не открыта')).toBeInTheDocument();
  });

  it('shows an error state with retry when the endpoint is missing', async () => {
    server.use(http.get(api('/dashboard'), () => problem(404, 'resource.not_found')));
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('Не удалось загрузить дашборд')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Повторить/ })).toBeInTheDocument();
  });
});
