import { describe, expect, it } from 'vitest';
import { weekDays, weekStart } from '@/pages/admin/staff/week';
import { formatMinutes } from './staff-errors';
import { isStrongPin, myPinSchema, shiftSchema } from './staff-schemas';

describe('staff schemas', () => {
  it.each([
    ['2580', true],
    ['482613', true],
    ['1111', false],
    ['1234', false],
    ['987654', false],
    ['123', false],
    ['12a4', false],
    ['1234567', false],
  ])('PIN %s strong = %s (mirrors server policy)', (pin, expected) => {
    expect(isStrongPin(pin)).toBe(expected);
  });

  it('requires matching PIN confirmation', () => {
    const result = myPinSchema.safeParse({ currentPassword: 'x', pin: '2580', confirmPin: '2581' });
    expect(result.success).toBe(false);
  });

  it('rejects equal shift start and end, allows overnight', () => {
    const base = { userId: 'u', date: '2026-11-16', roleNote: '', note: '' };
    expect(shiftSchema.safeParse({ ...base, startTime: '09:00', endTime: '09:00' }).success).toBe(false);
    expect(shiftSchema.safeParse({ ...base, startTime: '22:00', endTime: '06:00' }).success).toBe(true);
  });

  it('formats minutes and weeks', () => {
    expect(formatMinutes(125)).toBe('2:05');
    expect(formatMinutes(-30)).toBe('−0:30');
    expect(weekStart('2026-11-19')).toBe('2026-11-16');
    expect(weekStart('2026-11-16')).toBe('2026-11-16');
    expect(weekDays('2026-11-16').at(-1)).toBe('2026-11-22');
  });
});
