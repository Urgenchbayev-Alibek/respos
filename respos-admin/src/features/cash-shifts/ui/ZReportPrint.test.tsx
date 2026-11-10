import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { printArea } from '@/shared/ui';
import { makeCashShift } from '@/test/fixtures/payments';
import { renderWithProviders } from '@/test/test-utils';
import { Z_REPORT_PRINT_ID, ZReportPrint } from './ZReportPrint';

describe('ZReportPrint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
  });

  it('renders the 80 mm Z-report with server totals when printed', () => {
    vi.spyOn(window, 'print').mockImplementation(() => window.dispatchEvent(new Event('beforeprint')));
    const shift = makeCashShift({
      status: 'closed',
      closedAt: '2026-11-10T16:00:00Z',
      closedByName: 'Лола',
      actualCashAmount: 790000,
      difference: -10000,
      totalsByMethod: [
        { method: 'cash', amount: 300000 },
        { method: 'card', amount: 200000 },
      ],
    });
    renderWithProviders(<ZReportPrint shift={shift} />);
    expect(screen.queryByTestId('z-report')).not.toBeInTheDocument();

    act(() => printArea(Z_REPORT_PRINT_ID));

    const report = screen.getByTestId('z-report');
    expect(within(report).getByRole('heading', { name: 'Z-отчёт' })).toBeInTheDocument();
    expect(report).toHaveTextContent('Центр');
    expect(report).toHaveTextContent('Итого');
    expect(report).toHaveTextContent(/500\s?000/);
    expect(report).toHaveTextContent('Расхождение');
    expect(report).toHaveTextContent('Не является фискальным документом');
  });
});
