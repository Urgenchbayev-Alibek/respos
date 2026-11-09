import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { makeTable } from '@/test/fixtures/floor-orders';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { TableFormModal } from './TableFormModal';

const auth = makeAuth(makeUser({ permissions: [PERMISSIONS.tables.read, PERMISSIONS.tables.manage] }));
const areas = [{ id: 'a1', name: 'Основной', sortOrder: 1, isActive: true, tableCount: 0 }];

describe('TableFormModal', () => {
  it('validates capacity and sends grid position as numbers', async () => {
    let body: unknown = null;
    server.use(
      http.post(api('/tables'), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(makeTable({ id: 't9', number: '12' }), { status: 201 });
      }),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<TableFormModal table={null} areas={areas} onClose={onClose} />, { auth });

    await user.type(screen.getByLabelText(/Номер стола/), '12');
    const capacity = screen.getByLabelText(/Количество мест/);
    await user.clear(capacity);
    await user.type(capacity, '0');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText('Целое число от 1 до 100')).toBeInTheDocument();

    await user.clear(capacity);
    await user.type(capacity, '6');
    await user.type(screen.getByLabelText(/Колонка на плане/), '2');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toEqual({ number: '12', capacity: 6, areaId: 'a1', posX: 2, posY: null, isActive: true });
  });
});
