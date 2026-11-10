import { describe, expect, it } from 'vitest';
import { isUzPhone, normalizePhone } from './phone';

describe('phone helpers', () => {
  it.each([
    ['90 123-45-67', '+998901234567'],
    ['+998 (90) 123 45 67', '+998901234567'],
    ['998901234567', '+998901234567'],
    ['+7 701 123 45 67', '+77011234567'],
    ['12345', null],
    ['+99890123', null],
    ['90abc', null],
    ['', null],
  ])('normalizes %s like the server', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('accepts only Uzbek numbers for guests', () => {
    expect(isUzPhone('90 123 45 67')).toBe(true);
    expect(isUzPhone('+7 701 123 45 67')).toBe(false);
    expect(isUzPhone('+901234567')).toBe(false);
  });
});
