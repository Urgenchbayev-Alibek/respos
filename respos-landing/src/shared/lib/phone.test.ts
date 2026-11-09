import { extractLocalDigits, formatUzPhone, isValidUzPhone, toE164 } from './phone';

describe('phone helpers', () => {
  it('formats progressively with +998 prefix', () => {
    expect(formatUzPhone('9')).toBe('+998 9');
    expect(formatUzPhone('90123')).toBe('+998 90 123');
    expect(formatUzPhone('901234567')).toBe('+998 90 123-45-67');
    expect(formatUzPhone('+998 90 123 45 67 99')).toBe('+998 90 123-45-67');
  });

  it('validates exactly 9 local digits', () => {
    expect(isValidUzPhone('+998 90 123-45-67')).toBe(true);
    expect(isValidUzPhone('+998 90 123')).toBe(false);
    expect(isValidUzPhone('')).toBe(false);
  });

  it('normalizes to E.164', () => {
    expect(extractLocalDigits('+998 (90) 123-45-67')).toBe('901234567');
    expect(toE164('+998 90 123-45-67')).toBe('+998901234567');
    expect(toE164('998901234567')).toBe('+998901234567');
    expect(toE164('99 812-34-56')).toBe('+998998123456');
  });
});
