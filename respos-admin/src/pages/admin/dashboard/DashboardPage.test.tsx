import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { DashboardOverviewDto } from '@/entities/report/analytics.types';
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

const totals = (revenue: number, orders: number) => ({
  revenue, grossRevenue: revenue, refunds: 0, ordersCount: orders, averageCheck: revenue / orders, itemsSold: orders * 3, discountsAmount: 0, guestsCount: orders,
});

function overview(period: DashboardOverviewDto['period']): DashboardOverviewDto {
  return {
    period,
    from: '2026-11-10',
    to: '2026-11-10',
    previousFrom: '2026-11-09',
    previousTo: '2026-11-09',
    current: totals(1250000, period === 'today' ? 42 : 300),
    previous: totals(1000000, 40),
    deltas: { revenue: 25, ordersCount: 5, averageCheck: 19, itemsSold: null, discountsAmount: null, guestsCount: null },
    sparkline: [0, 1, 2].map((hour) => ({ date: '2026-11-10', hour, revenue: hour * 1000, orders: hour })),
    topItems: [{ menuItemId: 'p', name: 'Плов', quantity: 12, revenue: 480000, margin: 400000 }],
    bottomItems: [{ menuItemId: 'c', name: 'Компот', quantity: 1, revenue: 8000, margin: 6000 }],
    foodCostAlerts: {
      thresholdPercent: 35,
      aboveThresholdCount: 1,
      items: [{ menuItemId: 't', variantId: null, name: 'Чай', variantName: null, categoryName: 'Напитки', price: 10000, hasRecipe: true, hasMissingConversions: false, recipeCost: 5000, foodCostPercent: 50, marginAmount: 5000, marginPercent: 50, isAboveThreshold: true }],
    },
    isDemoData: true,
  };
}

describe('DashboardPage', () => {
  it('renders period KPIs with deltas, live stats, top/bottom dishes, food cost alerts and the demo badge', async () => {
    const periods: (string | null)[] = [];
    server.use(
      http.get(api('/dashboard'), () => HttpResponse.json(dashboard)),
      http.get(api('/dashboard/overview'), ({ request }) => {
        const period = new URL(request.url).searchParams.get('period') as DashboardOverviewDto['period'];
        periods.push(period);
        return HttpResponse.json(overview(period));
      }),
    );
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('+25 %')).toBeInTheDocument();
    expect(screen.getByText('7 из 20')).toBeInTheDocument();
    expect(screen.getByText('Плов')).toBeInTheDocument();
    expect(screen.getByText('Компот')).toBeInTheDocument();
    expect(screen.getByText('Чай')).toBeInTheDocument();
    expect(screen.getByText('50 %')).toBeInTheDocument();
    expect(screen.getByText('Демо')).toBeInTheDocument();
    expect(screen.getByText('Смена не открыта')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '7 дней' }));
    expect(await screen.findByText('300')).toBeInTheDocument();
    expect(periods).toEqual(['today', '7d']);
  });

  it('shows an error state with retry when the endpoint is missing', async () => {
    server.use(
      http.get(api('/dashboard'), () => problem(404, 'resource.not_found')),
      http.get(api('/dashboard/overview'), () => problem(404, 'resource.not_found')),
    );
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('Не удалось загрузить дашборд')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Повторить/ })).toBeInTheDocument();
  });
});
