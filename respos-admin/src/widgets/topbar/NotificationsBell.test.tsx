import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { NotificationsBell } from './NotificationsBell';

const notification = {
  id: 'n-1',
  type: 'stock_low',
  title: 'Низкий остаток: Рис',
  body: 'Осталось 3.5 кг',
  link: '/admin/inventory',
  branchId: 'b-1',
  isRead: false,
  createdAt: '2026-11-10T08:30:00Z',
  readAt: null,
};

describe('NotificationsBell', () => {
  it('shows the unread count, lists notifications and marks all read', async () => {
    let unread = 3;
    let readAll = false;
    server.use(
      http.get(api('/notifications/unread-count'), () => HttpResponse.json({ count: unread })),
      http.get(api('/notifications'), () =>
        HttpResponse.json({ items: [{ ...notification, isRead: readAll }], page: 1, pageSize: 6, totalCount: 1 }),
      ),
      http.post(api('/notifications/read-all'), () => {
        readAll = true;
        const marked = unread;
        unread = 0;
        return HttpResponse.json({ count: marked });
      }),
    );
    renderWithProviders(<NotificationsBell />, { auth: makeAuth(makeUser({ permissions: [P.notifications.read] })) });

    expect(await screen.findByTestId('notifications-unread-badge')).toHaveTextContent('3');
    const bell = screen.getByRole('button', { name: 'Уведомления: непрочитанных 3' });
    await userEvent.click(bell);
    expect(await screen.findByText('Низкий остаток: Рис')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Прочитать все' }));
    await waitFor(() => expect(screen.queryByTestId('notifications-unread-badge')).not.toBeInTheDocument());
    expect(readAll).toBe(true);
  });

  it('is hidden without notifications.read', () => {
    renderWithProviders(<NotificationsBell />, { auth: makeAuth(makeUser({ permissions: [P.orders.read] })) });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
