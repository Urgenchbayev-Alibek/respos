import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { SalesSummaryDto } from '@/entities/report/analytics.types';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { ReportsPage } from './ReportsPage';

const auth = makeAuth(makeUser({ permissions: [P.reports.read] }));
const exporter = makeAuth(makeUser({ permissions: [P.reports.read, P.reports.export] }));

const totals = (revenue: number, orders: number) => ({
  revenue,
  grossRevenue: revenue,
  refunds: 0,
  ordersCount: orders,
  averageCheck: orders ? revenue / orders : 0,
  itemsSold: orders * 2,
  discountsAmount: 0,
  guestsCount: orders,
});

function summary(byDay: SalesSummaryDto['byDay'], current = totals(0, 0), previous = totals(0, 0)): SalesSummaryDto {
  return {
    from: '2026-11-04',
    to: '2026-11-10',
    previousFrom: '2026-10-28',
    previousTo: '2026-11-03',
    current,
    previous,
    deltas: { revenue: previous.revenue ? 12.5 : null, ordersCount: -3.2, averageCheck: null, itemsSold: null, discountsAmount: null, guestsCount: null },
    byDay,
    previousByDay: [],
  };
}

const emptySummary = () => HttpResponse.json(summary([]));

beforeAll(() => {
  // recharts' ResponsiveContainer needs ResizeObserver (absent in jsdom).
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('ReportsPage', () => {
  it('renders server KPIs with Δ % vs the previous period, the revenue table view and sends the period', async () => {
    const captured: { params?: URLSearchParams } = {};
    server.use(
      http.get(api('/reports/sales-summary'), ({ request }) => {
        captured.params = new URL(request.url).searchParams;
        return HttpResponse.json(
          summary(
            [
              { date: '2026-11-09', revenue: 4100000, orders: 90 },
              { date: '2026-11-10', revenue: 3900000, orders: 85 },
            ],
            totals(38400000, 812),
            totals(34100000, 839),
          ),
        );
      }),
    );
    renderWithProviders(<ReportsPage />, { auth });

    expect(await screen.findByText('812')).toBeInTheDocument();
    expect(screen.getByText('+12,5 %')).toBeInTheDocument();
    expect(screen.getByText('-3,2 %')).toBeInTheDocument();
    expect(captured.params?.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(captured.params?.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.getByRole('img', { name: 'График выручки по дням' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Показать таблицей' }));
    expect(screen.getByRole('table', { name: 'Выручка по дням' })).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    // Export is UX-gated by reports.export.
    expect(screen.queryByRole('button', { name: /Экспорт/ })).not.toBeInTheDocument();
  });

  it('offers CSV / Excel / PDF export with reports.export and requests the chosen format', async () => {
    const formats: string[] = [];
    server.use(
      http.get(api('/reports/sales-summary'), emptySummary),
      http.get(api('/reports/:name/export'), ({ request, params }) => {
        formats.push(`${String(params.name)}:${new URL(request.url).searchParams.get('format')}`);
        return new HttpResponse(new Blob(['x']), { headers: { 'Content-Type': 'application/octet-stream' } });
      }),
    );
    globalThis.URL.createObjectURL ??= () => 'blob:test';
    globalThis.URL.revokeObjectURL ??= () => undefined;
    renderWithProviders(<ReportsPage />, { auth: exporter });

    const [summaryExport] = await screen.findAllByRole('button', { name: /Экспорт/ });
    await userEvent.click(summaryExport!);
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /PDF/ })).toBeInTheDocument();
    await userEvent.click(within(menu).getByRole('menuitem', { name: /Excel/ }));
    await vi.waitFor(() => expect(formats).toEqual(['sales-summary:xlsx']));
  });

  it('shows the empty state for a period without sales', async () => {
    server.use(
      http.get(api('/reports/sales-summary'), emptySummary),
      http.get(api('/reports/top-items'), () => HttpResponse.json([])),
    );
    renderWithProviders(<ReportsPage />, { auth });
    expect(await screen.findByText('Нет данных за период')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Блюда' }));
    expect(await screen.findByText('Нет данных за период')).toBeInTheDocument();
  });

  it('renders the ABC table with classes and switches the metric', async () => {
    const metrics: (string | null)[] = [];
    server.use(
      http.get(api('/reports/sales-summary'), emptySummary),
      http.get(api('/reports/abc'), ({ request }) => {
        metrics.push(new URL(request.url).searchParams.get('metric'));
        return HttpResponse.json({
          metric: 'revenue',
          total: 230000,
          items: [
            { menuItemId: 'm1', name: 'Плов', quantity: 4, revenue: 200000, cost: 20000, margin: 180000, value: 200000, sharePercent: 86.96, cumulativePercent: 86.96, class: 'A' },
            { menuItemId: 'm2', name: 'Чай', quantity: 3, revenue: 30000, cost: 15000, margin: 15000, value: 30000, sharePercent: 13.04, cumulativePercent: 100, class: 'B' },
          ],
        });
      }),
    );
    renderWithProviders(<ReportsPage />, { auth });
    await userEvent.click(await screen.findByRole('tab', { name: 'ABC-анализ' }));
    const table = await screen.findByRole('table', { name: 'ABC-анализ' });
    expect(within(table).getByText('Плов')).toBeInTheDocument();
    expect(within(table).getByText('B')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'По марже' }));
    await vi.waitFor(() => expect(metrics).toContain('margin'));
  });

  it('renders the heatmap as an accessible weekday × hour table', async () => {
    const cells = Array.from({ length: 7 * 24 }, (_, index) => ({
      weekday: Math.floor(index / 24) + 1,
      hour: index % 24,
      orders: index === 5 * 24 + 23 ? 4 : 0,
      revenue: index === 5 * 24 + 23 ? 120000 : 0,
    }));
    server.use(
      http.get(api('/reports/sales-summary'), emptySummary),
      http.get(api('/reports/heatmap'), () => HttpResponse.json({ maxRevenue: 120000, maxOrders: 4, cells })),
    );
    renderWithProviders(<ReportsPage />, { auth });
    await userEvent.click(await screen.findByRole('tab', { name: 'Тепловая карта' }));
    const table = await screen.findByRole('table', { name: /дням недели и часам/ });
    expect(within(table).getByRole('rowheader', { name: 'Сб' })).toBeInTheDocument();
    expect(within(table).getByTitle(/Сб 23:00/)).toHaveTextContent('4');
  });

  it('flags dishes above the food cost threshold', async () => {
    server.use(
      http.get(api('/reports/sales-summary'), emptySummary),
      http.get(api('/reports/food-cost'), () =>
        HttpResponse.json({
          thresholdPercent: 35,
          aboveThresholdCount: 1,
          items: [
            { menuItemId: 't', variantId: null, name: 'Чай', variantName: null, categoryName: 'Напитки', price: 10000, hasRecipe: true, hasMissingConversions: false, recipeCost: 5000, foodCostPercent: 50, marginAmount: 5000, marginPercent: 50, isAboveThreshold: true },
          ],
        }),
      ),
    );
    renderWithProviders(<ReportsPage />, { auth });
    await userEvent.click(await screen.findByRole('tab', { name: 'Фудкост' }));
    expect(await screen.findByText('Блюд с фудкостом выше 35 %: 1')).toBeInTheDocument();
    expect(screen.getByText('50 %')).toBeInTheDocument();
  });

  it('renders stock movement totals per type and ingredient (backend StockMovementTotalDto)', async () => {
    server.use(
      http.get(api('/reports/sales-summary'), emptySummary),
      http.get(api('/reports/stock-movements'), () =>
        HttpResponse.json([
          { type: 'write_off', ingredientId: 'ing-1', ingredientName: 'Рис девзира', unitCode: 'kg', quantity: -2.5, count: 3 },
          { type: 'receipt', ingredientId: 'ing-1', ingredientName: 'Рис девзира', unitCode: 'kg', quantity: 50, count: 1 },
        ]),
      ),
    );
    renderWithProviders(<ReportsPage />, { auth });
    await userEvent.click(await screen.findByRole('tab', { name: 'Движения' }));
    expect(await screen.findByText('Списание')).toBeInTheDocument();
    expect(screen.getAllByText('Рис девзира')).toHaveLength(2);
  });

  it('validates a custom period', async () => {
    server.use(http.get(api('/reports/sales-summary'), emptySummary));
    renderWithProviders(<ReportsPage />, { auth });
    await userEvent.click(screen.getByRole('button', { name: 'Свой период' }));
    const from = screen.getByLabelText('С даты');
    await userEvent.clear(from);
    expect(await screen.findByText(/Укажите корректный период/)).toBeInTheDocument();
  });
});
