import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { KitchenTicketDto } from '@/entities/kitchen-ticket/kitchen-ticket.types';
import { api, http, HttpResponse, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { KitchenBoardPage } from './KitchenBoardPage';

const realtime = vi.hoisted(() => {
  const handlers = new Map<string, Set<(payload: unknown) => void>>();
  return {
    handlers,
    emit: (name: string, payload: unknown) => handlers.get(name)?.forEach((handler) => handler(payload)),
  };
});

vi.mock('@/shared/realtime', async () => {
  const { useEffect, useRef } = await import('react');
  return {
    HUB_METHODS: { joinBranch: 'JoinBranch', joinKitchenStation: 'JoinKitchenStation', leaveKitchenStation: 'LeaveKitchenStation' },
    hubManager: { onConnected: () => () => undefined, invoke: async () => undefined },
    useRealtimeStatus: () => 'connected',
    useRealtimeEvent: (name: string, handler: (payload: unknown) => void) => {
      const ref = useRef(handler);
      ref.current = handler;
      useEffect(() => {
        const set = realtime.handlers.get(name) ?? new Set();
        const listener = (payload: unknown) => ref.current(payload);
        set.add(listener);
        realtime.handlers.set(name, set);
        return () => void set.delete(listener);
      }, [name]);
    },
  };
});

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function ticket(overrides: Partial<KitchenTicketDto>): KitchenTicketDto {
  return {
    id: 't1',
    number: 118,
    orderId: 'o1',
    orderNumber: 42,
    tableNumber: '7',
    waiterName: 'Шерзод',
    stationId: 's1',
    stationName: 'Горячий цех',
    status: 'new',
    createdAt: minutesAgo(1),
    startedAt: null,
    readyAt: null,
    items: [
      { id: 'i1', orderItemId: 'oi1', name: 'Лагман', variantName: null, quantity: 1, modifiers: ['Без лука'], comment: 'Без острого', status: 'new' },
    ],
    ...overrides,
  };
}

const auth = makeAuth(makeUser({ permissions: ['kitchen.read', 'kitchen.status.update'] }));

function mockApi(getTickets: () => KitchenTicketDto[]) {
  server.use(
    http.get(api('/kitchen-stations'), () =>
      HttpResponse.json([{ id: 's1', name: 'Горячий цех', sortOrder: 1, isActive: true }]),
    ),
    http.get(api('/kitchen/tickets'), () => HttpResponse.json(getTickets())),
  );
}

describe('KitchenBoardPage', () => {
  it('renders tickets in status columns with items, modifiers, comments and timer levels', async () => {
    mockApi(() => [
      ticket({}),
      ticket({ id: 't2', number: 115, tableNumber: '11', status: 'in_progress', createdAt: minutesAgo(15) }),
      ticket({ id: 't3', number: 112, tableNumber: '3', status: 'in_progress', createdAt: minutesAgo(25) }),
    ]);
    renderWithProviders(<KitchenBoardPage />, { auth });

    const first = await screen.findByTestId('ticket-t1');
    expect(within(first).getByText('#118 · Стол 7')).toBeInTheDocument();
    expect(within(first).getByText('Лагман')).toBeInTheDocument();
    expect(within(first).getByText('Без лука')).toBeInTheDocument();
    expect(within(first).getByText('Без острого')).toBeInTheDocument();
    expect(first).toHaveAttribute('data-level', 'normal');
    expect(screen.getByTestId('ticket-t2')).toHaveAttribute('data-level', 'warning');
    expect(screen.getByTestId('ticket-t3')).toHaveAttribute('data-level', 'danger');
    expect(within(screen.getByRole('region', { name: 'Новые' })).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Готовятся' })).getByText('2')).toBeInTheDocument();
  });

  it('refetches on KitchenTicketCreated and highlights the new ticket', async () => {
    let tickets = [ticket({})];
    mockApi(() => tickets);
    renderWithProviders(<KitchenBoardPage />, { auth });
    await screen.findByTestId('ticket-t1');

    tickets = [ticket({}), ticket({ id: 't9', number: 119, tableNumber: '9' })];
    act(() => realtime.emit('KitchenTicketCreated', { ticketId: 't9', branchId: 'branch-1' }));

    const fresh = await screen.findByTestId('ticket-t9');
    expect(within(fresh).getByText('Новый')).toBeInTheDocument();
    expect(within(screen.getByTestId('ticket-t1')).queryByText('Новый')).not.toBeInTheDocument();
  });

  it('starts a ticket and refetches', async () => {
    let started = false;
    mockApi(() => [ticket(started ? { status: 'in_progress' } : {})]);
    server.use(
      http.post(api('/kitchen/tickets/t1/start'), () => {
        started = true;
        return HttpResponse.json(ticket({ status: 'in_progress' }));
      }),
    );
    renderWithProviders(<KitchenBoardPage />, { auth });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Начать' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Готово' })).toBeInTheDocument());
    expect(started).toBe(true);
  });

  it('remembers the selected station on this device', async () => {
    mockApi(() => [ticket({})]);
    renderWithProviders(<KitchenBoardPage />, { auth });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Горячий цех' }));

    expect(localStorage.getItem('respos.kds.station')).toBe('s1');
    expect(screen.getByRole('button', { name: 'Горячий цех' })).toHaveAttribute('aria-pressed', 'true');
  });
});
