import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { TableQrPage } from './TableQrPage';

const table = (id: string, number: string) => ({
  id,
  number,
  capacity: 4,
  areaId: 'a1',
  areaName: 'Зал',
  status: 'available',
  isActive: true,
  posX: null,
  posY: null,
  activeOrderId: null,
  activeOrderTotal: null,
  nextReservation: null,
});

const auth = makeAuth(makeUser({ permissions: ['tables.read', 'tables.manage', 'branches.read'] }));

describe('TableQrPage', () => {
  it('renders a QR card per selected table for the branch slug', async () => {
    server.use(
      http.get(api('/tables'), () => HttpResponse.json([table('t2', '10'), table('t1', '2')])),
      http.get(api('/branches'), () =>
        HttpResponse.json([{ id: 'branch-1', name: 'Центр', address: null, phone: null, timezone: 'Asia/Tashkent', isActive: true, slug: 'demo' }]),
      ),
    );
    renderWithProviders(<TableQrPage />, { auth });

    await waitFor(() => expect(screen.getAllByTestId('table-qr-card')).toHaveLength(2));
    expect(screen.getAllByText(/^Стол (2|10)$/).map((node) => node.textContent)).toEqual(['Стол 2', 'Стол 10']);
    await waitFor(() => expect(screen.getByRole('img', { name: 'QR-код стола 2' }).innerHTML).toContain('<svg'));

    await userEvent.click(screen.getByRole('checkbox', { name: 'Стол 10 · Зал' }));
    expect(screen.getAllByTestId('table-qr-card')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Печать (1)' })).toBeEnabled();
  });

  it('asks to configure the slug when the branch has none', async () => {
    server.use(
      http.get(api('/tables'), () => HttpResponse.json([table('t1', '1')])),
      http.get(api('/branches'), () =>
        HttpResponse.json([{ id: 'branch-1', name: 'Центр', address: null, phone: null, timezone: 'Asia/Tashkent', isActive: true, slug: null }]),
      ),
    );
    renderWithProviders(<TableQrPage />, { auth });

    expect(await screen.findByText('У филиала не задан адрес публичного меню.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть настройки филиала' })).toHaveAttribute('href', '/admin/branches/branch-1/settings');
  });
});
