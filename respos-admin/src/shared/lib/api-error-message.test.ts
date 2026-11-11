import { afterAll, describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api/api-error';
import { LANGUAGES } from '@/shared/constants/locale';
import { i18n } from '@/shared/i18n';
import { getErrorMessage } from './api-error-message';

describe('getErrorMessage', () => {
  afterAll(() => i18n.changeLanguage('ru'));

  it('maps a server code to its localized message', () => {
    const error = new ApiError({ status: 401, code: 'auth.invalid_credentials', title: 'Invalid credentials' });
    expect(getErrorMessage(error, i18n.t)).toBe('Неверный email или пароль.');
  });

  it('falls back to the server title for an unknown code, then to the generic message', () => {
    expect(getErrorMessage(new ApiError({ status: 409, code: 'some.new_code', title: 'Server says no' }), i18n.t)).toBe('Server says no');
    expect(getErrorMessage(new ApiError({ status: 409, code: 'some.new_code' }), i18n.t)).toBe('Что-то пошло не так. Попробуйте ещё раз.');
    expect(getErrorMessage(new Error('boom'), i18n.t)).toBe('Что-то пошло не так. Попробуйте ещё раз.');
  });

  // The desktop shell's gateway answers 502 with this code when the restaurant server does not respond; its
  // English `title` must never reach the screen.
  it.each(LANGUAGES)('explains an unreachable server in %s (desktop shell gateway)', async (language) => {
    await i18n.changeLanguage(language);
    const error = new ApiError({ status: 502, code: 'desktop.server_unreachable', title: 'Server unreachable' });
    const message = getErrorMessage(error, i18n.t);
    expect(message).not.toBe('Server unreachable');
    expect(message).toBe(i18n.t('errors:desktop.server_unreachable'));
    expect(message.length).toBeGreaterThan(20);
  });
});
