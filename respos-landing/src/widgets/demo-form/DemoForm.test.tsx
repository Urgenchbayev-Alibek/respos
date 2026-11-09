import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { jsonResponse, renderWithRouter } from '@/test/renderApp';
import { DemoForm } from './DemoForm';

const setup = () => {
  const user = userEvent.setup();
  renderWithRouter(<DemoForm />);
  return user;
};

const fillValid = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Ваше имя'), 'Азиз');
  await user.type(screen.getByLabelText('Телефон'), '901234567');
  await user.type(screen.getByLabelText('Название заведения'), 'Чайхана Навруз');
  await user.type(screen.getByLabelText(/^Город/), 'Ташкент');
};

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Отправить заявку' }));

describe('DemoForm', () => {
  it('shows required-field errors next to fields and does not send', async () => {
    const user = setup();
    await submit(user);

    expect(screen.getByRole('alert')).toHaveTextContent('Проверьте выделенные поля.');
    const name = screen.getByLabelText('Ваше имя');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('Заполните это поле.');
    expect(screen.getByLabelText('Телефон')).toHaveAccessibleDescription('Заполните это поле.');
    expect(screen.getByLabelText('Название заведения')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^E-mail/)).not.toHaveAttribute('aria-invalid');
    expect(name).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('masks the phone as +998 and validates phone and e-mail format', async () => {
    const user = setup();
    const phone = screen.getByLabelText('Телефон');
    await user.type(phone, '90123');
    expect(phone).toHaveValue('+998 90 123');

    await user.type(screen.getByLabelText(/^E-mail/), 'not-an-email');
    await submit(user);

    expect(phone).toHaveAccessibleDescription('Введите номер в формате +998 XX XXX-XX-XX.');
    expect(screen.getByLabelText(/^E-mail/)).toHaveAccessibleDescription('Введите корректный e-mail.');
  });

  it('submits a valid request and shows success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 202 }));
    const user = setup();
    await fillValid(user);
    await submit(user);

    expect(await screen.findByRole('heading', { name: 'Заявка отправлена' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toMatch(/\/public\/demo-requests$/);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'Азиз',
      phone: '+998901234567',
      restaurantName: 'Чайхана Навруз',
      city: 'Ташкент',
      website: '',
    });
  });

  it('shows the rate-limit message on 429', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: 429, code: 'rate_limit.exceeded' }, 429));
    const user = setup();
    await fillValid(user);
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Слишком много заявок/);
    expect(screen.getByRole('button', { name: 'Отправить заявку' })).toBeEnabled();
  });

  it('maps server validation errors (ProblemDetails) onto fields', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ status: 400, code: 'validation.failed', errors: { Phone: ['Номер не поддерживается.'] } }, 400),
    );
    const user = setup();
    await fillValid(user);
    await submit(user);

    await waitFor(() =>
      expect(screen.getByLabelText('Телефон')).toHaveAccessibleDescription('Номер не поддерживается.'),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Проверьте выделенные поля.');
  });

  it('shows a network error when the server is unreachable', async () => {
    const user = setup();
    await fillValid(user);
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Не удалось связаться с сервером/);
  });

  it('shows a generic error on 500', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: 500, code: 'server.error' }, 500));
    const user = setup();
    await fillValid(user);
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось отправить заявку. Попробуйте позже.');
  });

  it('does not send anything when the honeypot is filled', async () => {
    const user = setup();
    await fillValid(user);
    const honeypot = document.querySelector<HTMLInputElement>('input[name="website"]')!;
    await user.type(honeypot, 'http://spam.example');
    await submit(user);

    expect(await screen.findByRole('heading', { name: 'Заявка отправлена' })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
