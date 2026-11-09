import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CashShiftDto } from '@/entities/cash-shift/cash-shift.types';
import { makeCashShift } from '@/test/fixtures/payments';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { CloseShiftModal } from './CloseShiftModal';

const shift: CashShiftDto = makeCashShift({ expectedCashAmount: 3620000 });

const text = (testId: string) => screen.getByTestId(testId).textContent?.replace(/\s/g, ' ') ?? '';

describe('CloseShiftModal', () => {
  it('shows expected vs actual with the difference, then the server result after confirm', async () => {
    let body: unknown = null;
    server.use(
      http.post(api('/cash-shifts/sh1/close'), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          ...shift,
          status: 'closed',
          closedAt: '2026-11-10T18:00:00Z',
          closedBy: shift.openedBy,
          closedByName: 'Лола',
          actualCashAmount: 3600000,
          difference: -20000,
        });
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(<CloseShiftModal shift={shift} onClose={onClose} />, {
      auth: makeAuth(makeUser({ permissions: ['cash-shifts.close'] })),
    });
    const user = userEvent.setup();

    expect(text('shift-expected')).toMatch(/3 620 000/);
    await user.type(screen.getByLabelText(/Фактически наличных/), '3600000');
    await user.click(screen.getByRole('button', { name: 'Далее' }));

    expect(text('shift-actual')).toMatch(/3 600 000/);
    expect(text('shift-difference')).toMatch(/Расхождение \(предварительно\)/);
    expect(text('shift-difference')).toMatch(/-20 000|−20 000/);

    await user.click(screen.getByRole('button', { name: 'Закрыть смену' }));

    expect(await screen.findByText('Смена закрыта', { selector: 'h2' })).toBeInTheDocument();
    expect(body).toEqual({ actualCashAmount: 3600000 });
    expect(text('shift-difference')).toMatch(/^Расхождение/);
    expect(text('shift-difference')).toMatch(/20 000/);
    expect(screen.getByTestId('shift-difference').className).toMatch(/negative/);
  });

  it('requires the counted amount', async () => {
    renderWithProviders(<CloseShiftModal shift={shift} onClose={() => undefined} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Далее' }));

    expect(await screen.findByText('Обязательное поле')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Закрыть смену' })).not.toBeInTheDocument();
  });
});
