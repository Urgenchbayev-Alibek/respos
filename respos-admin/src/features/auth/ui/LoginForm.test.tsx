import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/api-error';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { LoginForm } from './LoginForm';

function setup(login = vi.fn(async () => makeUser())) {
  const onSuccess = vi.fn();
  renderWithProviders(<LoginForm onSuccess={onSuccess} />, { auth: makeAuth(null, { login }) });
  return { login, onSuccess, user: userEvent.setup() };
}

describe('LoginForm', () => {
  it('shows field errors next to the fields and does not submit invalid input', async () => {
    const { login, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findAllByText('Обязательное поле')).toHaveLength(2);
    expect(screen.getByLabelText(/Email/)).toHaveAttribute('aria-invalid', 'true');
    expect(login).not.toHaveBeenCalled();
  });

  it('validates the email format', async () => {
    const { login, user } = setup();
    await user.type(screen.getByLabelText(/Email/), 'not-an-email');
    await user.type(screen.getByLabelText(/Пароль/), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Введите корректный email')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('submits valid credentials and calls onSuccess', async () => {
    const { login, onSuccess, user } = setup();
    await user.type(screen.getByLabelText(/Email/), 'owner@demo.respos.uz');
    await user.type(screen.getByLabelText(/Пароль/), 'Demo123!');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(login).toHaveBeenCalledWith({ email: 'owner@demo.respos.uz', password: 'Demo123!' });
  });

  it('maps server error codes to localized messages', async () => {
    const login = vi.fn(async () => {
      throw new ApiError({ status: 401, code: 'auth.invalid_credentials', title: 'Invalid credentials' });
    });
    const { onSuccess, user } = setup(login);
    await user.type(screen.getByLabelText(/Email/), 'owner@demo.respos.uz');
    await user.type(screen.getByLabelText(/Пароль/), 'wrong-pass1');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный email или пароль.');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('falls back to the server title for unknown codes', async () => {
    const login = vi.fn(async () => {
      throw new ApiError({ status: 422, code: 'auth.something_new', title: 'Something new happened' });
    });
    const { user } = setup(login);
    await user.type(screen.getByLabelText(/Email/), 'owner@demo.respos.uz');
    await user.type(screen.getByLabelText(/Пароль/), 'whatever1');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something new happened');
  });
});
