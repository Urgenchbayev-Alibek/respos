import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '@/shared/constants/permissions';
import type * as Realtime from '@/shared/realtime';
import { makeMenuItem, makeOrder, makeOrderItem, makePosMenu, makeTable } from '@/test/fixtures/floor-orders';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderRoutes } from '@/test/test-utils';
import { WaiterOrderPage } from './WaiterOrderPage';

const realtime = vi.hoisted(() => new Map<string, (payload: unknown) => void>());
vi.mock('@/shared/realtime', async (importOriginal) => ({
  ...(await importOriginal<typeof Realtime>()),
  useRealtimeEvent: (name: string, handler: (payload: unknown) => void) => {
    realtime.set(name, handler);
  },
}));

const routes = [
  { path: '/waiter/orders/new', element: <WaiterOrderPage /> },
  { path: '/waiter/orders/:orderId', element: <WaiterOrderPage /> },
];
const auth = makeAuth(
  makeUser({
    permissions: [PERMISSIONS.orders.read, PERMISSIONS.orders.create, PERMISSIONS.orders.update, PERMISSIONS.menu.read],
  }),
);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function useBaseHandlers() {
  server.use(
    http.get(api('/menu/pos'), () => HttpResponse.json(makePosMenu())),
    http.get(api('/tables'), () => HttpResponse.json([makeTable()])),
  );
}

describe('WaiterOrderPage', () => {
  it('creates an order from the cart and sends it to the kitchen with an Idempotency-Key', async () => {
    useBaseHandlers();
    let created: unknown = null;
    let sendKey: string | null = null;
    const sent = makeOrder({ status: 'submitted', items: [makeOrderItem({ status: 'sent', sentAt: '2026-11-10T07:05:00Z' })] });
    server.use(
      http.post(api('/orders'), async ({ request }) => {
        created = await request.json();
        return HttpResponse.json(makeOrder(), { status: 201 });
      }),
      http.post(api('/orders/o1/send-to-kitchen'), ({ request }) => {
        sendKey = request.headers.get('Idempotency-Key');
        return HttpResponse.json(sent);
      }),
      http.get(api('/orders/o1'), () => HttpResponse.json(sent)),
    );
    const user = userEvent.setup();
    const { getLocation } = renderRoutes(routes, { auth, route: '/waiter/orders/new?tableId=t1&guests=2' });

    expect(await screen.findByRole('heading', { name: /Стол 7/ })).toBeInTheDocument();
    const dish = await screen.findByRole('button', { name: /Плов/ });
    await user.click(dish);
    await user.click(dish);
    const line = screen.getByTestId('cart-line');
    expect(within(line).getByText('Новая')).toBeInTheDocument();
    expect(within(line).getByText('2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Отправить на кухню (2)' }));

    await waitFor(() => expect(getLocation()?.pathname).toBe('/waiter/orders/o1'));
    expect(created).toEqual({
      type: 'dine_in',
      tableId: 't1',
      guestCount: 2,
      items: [{ menuItemId: 'm1', quantity: 2, modifierOptionIds: [] }],
    });
    expect(sendKey).toMatch(UUID);
    expect(await screen.findByText('Отправлена')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /#0042/ })).toBeInTheDocument();
  });

  it('adds items to an open order, toasts OrderItemReady and marks a ready item served', async () => {
    useBaseHandlers();
    let order = makeOrder({
      status: 'partially_ready',
      items: [makeOrderItem({ status: 'ready', sentAt: '2026-11-10T07:05:00Z' })],
    });
    let added: unknown = null;
    let served = false;
    server.use(
      http.get(api('/orders/o1'), () => HttpResponse.json(order)),
      http.post(api('/orders/o1/items'), async ({ request }) => {
        added = await request.json();
        order = { ...order, items: [...order.items, makeOrderItem({ id: 'i2', name: 'Лагман', menuItemId: 'm2' })] };
        return HttpResponse.json(order);
      }),
      http.post(api('/orders/o1/send-to-kitchen'), () => HttpResponse.json(order)),
      http.post(api('/orders/o1/items/i1/serve'), () => {
        served = true;
        order = { ...order, items: [makeOrderItem({ status: 'served' }), ...order.items.slice(1)] };
        return HttpResponse.json(order);
      }),
    );
    server.use(
      http.get(api('/menu/pos'), () =>
        HttpResponse.json(makePosMenu([makeMenuItem(), makeMenuItem({ id: 'm2', name: 'Лагман', price: 38000 })])),
      ),
    );
    const user = userEvent.setup();
    renderRoutes(routes, { auth, route: '/waiter/orders/o1' });

    expect(await screen.findByText('Готова')).toBeInTheDocument();
    act(() => realtime.get('OrderItemReady')?.({ orderId: 'o1', orderItemId: 'i1', tableId: 't1', itemName: 'Плов' }));
    expect(await screen.findByText('Готово к подаче')).toBeInTheDocument();
    expect(screen.getByText('Стол 7 — Плов')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Подано: Плов' }));
    await waitFor(() => expect(served).toBe(true));

    await user.click(screen.getByRole('button', { name: /Лагман/ }));
    await user.click(screen.getByRole('button', { name: 'Отправить на кухню (1)' }));
    await waitFor(() => expect(added).toEqual({ items: [{ menuItemId: 'm2', quantity: 1, modifierOptionIds: [] }] }));
  });
  it('edits quantity and comment of a saved new item and cancels it with a reason', async () => {
    useBaseHandlers();
    let order = makeOrder({ items: [makeOrderItem(), makeOrderItem({ id: 'i2', name: 'Лагман', status: 'sent' })] });
    const updates: unknown[] = [];
    let cancelBody: unknown = null;
    server.use(
      http.get(api('/orders/o1'), () => HttpResponse.json(order)),
      http.put(api('/orders/o1/items/i1'), async ({ request }) => {
        const body = (await request.json()) as { quantity: number; comment: string | null };
        updates.push(body);
        order = { ...order, items: [makeOrderItem({ ...body }), ...order.items.slice(1)] };
        return HttpResponse.json(order);
      }),
      http.post(api('/orders/o1/items/i1/cancel'), async ({ request }) => {
        cancelBody = await request.json();
        order = { ...order, items: [makeOrderItem({ status: 'cancelled' }), ...order.items.slice(1)] };
        return HttpResponse.json(order);
      }),
    );
    const user = userEvent.setup();
    renderRoutes(routes, { auth, route: '/waiter/orders/o1' });

    await user.click(await screen.findByRole('button', { name: 'Увеличить: Плов' }));
    await waitFor(() => expect(updates).toEqual([{ quantity: 3, comment: null }]));
    expect(screen.queryByRole('button', { name: 'Увеличить: Лагман' })).not.toBeInTheDocument();
    // A sent item needs orders.cancel, which this waiter does not have.
    expect(screen.queryByRole('button', { name: 'Отменить позицию: Лагман' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Комментарий: Плов' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), ' без лука ');
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(updates).toHaveLength(2));
    expect(updates[1]).toEqual({ quantity: 3, comment: 'без лука' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('без лука')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Отменить позицию: Плов' }));
    const confirm = await screen.findByRole('dialog');
    await user.type(within(confirm).getByRole('textbox'), 'Гость передумал');
    await user.click(within(confirm).getByRole('button', { name: 'Отменить позицию' }));
    await waitFor(() => expect(cancelBody).toEqual({ reason: 'Гость передумал' }));
  });
});
