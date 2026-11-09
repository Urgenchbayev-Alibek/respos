import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { makeTable } from '@/test/fixtures/floor-orders';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { TablesPage } from './TablesPage';

const tables = [
  makeTable({ id: 't1', number: '1', status: 'available' }),
  makeTable({ id: 't2', number: '2', status: 'occupied', activeOrderId: 'o1', activeOrderTotal: 320000 }),
  makeTable({
    id: 't3',
    number: '3',
    status: 'reserved',
    nextReservation: { id: 'r1', startsAt: '2026-11-10T14:00:00Z', guestName: 'Каримов' },
  }),
  makeTable({ id: 't4', number: '4', status: 'unavailable', areaId: 'a2', areaName: 'Терраса' }),
];

function mockFloor() {
  server.use(
    http.get(api('/dining-areas'), () =>
      HttpResponse.json([
        { id: 'a2', name: 'Терраса', sortOrder: 2, isActive: true, tableCount: 0 },
        { id: 'a1', name: 'Основной', sortOrder: 1, isActive: true, tableCount: 1 },
      ]),
    ),
    http.get(api('/tables'), () => HttpResponse.json(tables)),
  );
}

describe('TablesPage', () => {
  it('renders the floor grid with status colours, order totals and next reservation', async () => {
    mockFloor();
    renderWithProviders(<TablesPage />, { auth: makeAuth(makeUser({ permissions: [PERMISSIONS.tables.read] })) });

    const occupied = await screen.findByTestId('table-tile-2');
    expect(occupied).toHaveAttribute('data-status', 'occupied');
    expect(within(occupied).getByText('Занят')).toBeInTheDocument();
    expect(within(occupied).getByText(/320\s000/)).toBeInTheDocument();

    expect(screen.getByTestId('table-tile-1')).toHaveAttribute('data-status', 'available');
    expect(within(screen.getByTestId('table-tile-1')).getByText('Свободен')).toBeInTheDocument();
    const reserved = screen.getByTestId('table-tile-3');
    expect(within(reserved).getByText('Забронирован')).toBeInTheDocument();
    expect(within(reserved).getByText(/19:00 · Каримов/)).toBeInTheDocument();
    expect(within(screen.getByTestId('table-tile-4')).getByText('Недоступен')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Добавить стол' })).not.toBeInTheDocument();
  });

  it('filters by area and switches to the list view', async () => {
    mockFloor();
    const user = userEvent.setup();
    renderWithProviders(<TablesPage />, {
      auth: makeAuth(makeUser({ permissions: [PERMISSIONS.tables.read, PERMISSIONS.tables.manage] })),
    });

    const tabs = await screen.findAllByRole('tab', { name: 'Терраса' });
    await user.click(tabs[0] as HTMLElement);
    expect(screen.getByTestId('table-tile-4')).toBeInTheDocument();
    expect(screen.queryByTestId('table-tile-1')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Список' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Действия: стол 4' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Добавить стол' }).length).toBeGreaterThan(0);
  });
});
