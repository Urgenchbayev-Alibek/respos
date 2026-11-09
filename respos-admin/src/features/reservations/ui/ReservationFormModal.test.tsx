import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { makeTable } from '@/test/fixtures/floor-orders';
import { api, http, problem, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { ReservationFormModal } from './ReservationFormModal';

const auth = makeAuth(makeUser({ permissions: [PERMISSIONS.reservations.read, PERMISSIONS.reservations.manage] }));

describe('ReservationFormModal', () => {
  it('shows the reservation.time_conflict error and keeps the form open', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(api('/reservations'), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return problem(409, 'reservation.time_conflict');
      }),
    );
    const onClose = vi.fn();
    const onConflict = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ReservationFormModal
        reservation={null}
        date="2026-11-10"
        tables={[makeTable()]}
        areas={[]}
        onClose={onClose}
        onConflict={onConflict}
      />,
      { auth },
    );

    await user.type(screen.getByLabelText(/Имя гостя/), 'Каримов');
    await user.type(screen.getByLabelText(/Телефон/), '+998 90 123 45 67');
    await user.selectOptions(screen.getByLabelText(/^Стол/), 't1');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Стол уже забронирован на это время.')).toBeInTheDocument();
    expect(screen.getByText('На этот стол уже есть бронь в это время')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onConflict).toHaveBeenCalledWith(expect.objectContaining({ tableId: 't1' }));
    expect(body).toMatchObject({
      tableId: 't1',
      guestName: 'Каримов',
      guestPhone: '+998 90 123 45 67',
      guestCount: 2,
      startsAt: '2026-11-10T14:00:00.000Z',
      endsAt: '2026-11-10T16:00:00.000Z',
    });
  });

  it('validates required fields and end after start before calling the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReservationFormModal reservation={null} date="2026-11-10" tables={[]} areas={[]} onClose={vi.fn()} />, {
      auth,
    });
    const end = screen.getByLabelText(/Окончание/);
    await user.clear(end);
    await user.type(end, '18:00');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(screen.getAllByText('Обязательное поле')).toHaveLength(2));
    expect(screen.getByText('Окончание должно быть позже начала')).toBeInTheDocument();
  });
});
