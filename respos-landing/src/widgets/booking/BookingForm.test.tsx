import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { BookingPage } from '@/pages/BookingPage';
import { jsonResponse, renderWithRouter } from '@/test/renderApp';
import { BookingForm } from './BookingForm';

const BRANCH = 'demo';

const availability = {
  branchSlug: BRANCH,
  branchName: 'Центр',
  date: '2026-12-01',
  timezone: 'Asia/Tashkent',
  durationMinutes: 120,
  maxGuests: 20,
  slots: [
    { time: '18:00', startsAt: '2026-12-01T13:00:00Z', available: false },
    { time: '19:00', startsAt: '2026-12-01T14:00:00Z', available: true },
  ],
};

const created = {
  reservationId: 'r1', status: 'pending', startsAt: '2026-12-01T14:00:00Z', endsAt: '2026-12-01T16:00:00Z', guests: 2, branchName: 'Центр',
};

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

type FetchArgs = [string, RequestInit | undefined];

const mockApi = (post: () => Response) => {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
    Promise.resolve(init?.method === 'POST' ? post() : ok(availability)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const fill = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('radio', { name: '19:00' }));
  await user.type(screen.getByLabelText('Ваше имя'), 'Азиз');
  await user.type(screen.getByLabelText('Телефон'), '901234567');
};

describe('BookingForm', () => {
  it('shows free slots, books and shows the pending success state', async () => {
    const fetchMock = mockApi(() => ok(created));
    const user = userEvent.setup();
    renderWithRouter(<BookingForm branchSlug={BRANCH} />);

    expect(await screen.findByRole('radio', { name: /18:00/ })).toBeDisabled();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Забронировать' }));

    expect(await screen.findByRole('heading', { name: 'Заявка на бронь принята' })).toBeInTheDocument();
    const post = (fetchMock.mock.calls as FetchArgs[]).find(([, init]) => init?.method === 'POST')!;
    expect(post[0]).toContain(`/public/branches/${BRANCH}/reservations`);
    expect(JSON.parse(String(post[1]?.body))).toMatchObject({ time: '19:00', guests: 2, name: 'Азиз', phone: '+998901234567', website: '' });
    expect((fetchMock.mock.calls as FetchArgs[])[0]![0]).toContain('/availability?date=');
  });

  it('validates time, name and phone without sending', async () => {
    const fetchMock = mockApi(() => ok(created));
    const user = userEvent.setup();
    renderWithRouter(<BookingForm branchSlug={BRANCH} />);
    await screen.findByRole('radio', { name: '19:00' });
    await user.click(screen.getByRole('button', { name: 'Забронировать' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Проверьте выделенные поля.');
    expect(screen.getByText('Выберите время.')).toBeInTheDocument();
    expect(screen.getByLabelText('Ваше имя')).toHaveAttribute('aria-invalid', 'true');
    expect((fetchMock.mock.calls as FetchArgs[]).some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('asks to pick another time when the slot was just taken', async () => {
    mockApi(() => jsonResponse({ status: 409, code: 'reservation.slot_unavailable', title: 'No free table' }, 409));
    const user = userEvent.setup();
    renderWithRouter(<BookingForm branchSlug={BRANCH} />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Забронировать' }));

    expect(await screen.findByText('Это время только что заняли. Выберите другое.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('radio', { name: '19:00' })).not.toBeChecked());
  });

  it('shows a friendly notice when the branch is not configured', () => {
    renderWithRouter(<BookingPage branchSlug={null} />);
    expect(screen.getByRole('heading', { name: 'Онлайн-бронирование пока не подключено' })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
