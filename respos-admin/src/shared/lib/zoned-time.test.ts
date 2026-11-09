import { describe, expect, it } from 'vitest';
import { addDaysToDateString, addMinutesToTime, utcToZonedParts, zonedToUtcIso } from './zoned-time';

describe('zoned-time', () => {
  it('converts branch wall clock to UTC and back', () => {
    expect(zonedToUtcIso('2026-11-10', '19:30', 'Asia/Tashkent')).toBe('2026-11-10T14:30:00.000Z');
    expect(utcToZonedParts('2026-11-10T14:30:00Z', 'Asia/Tashkent')).toEqual({
      date: '2026-11-10',
      time: '19:30',
      minutes: 1170,
    });
    expect(utcToZonedParts('2026-11-10T20:00:00Z', 'Asia/Tashkent')?.date).toBe('2026-11-11');
  });

  it('handles DST zones', () => {
    expect(zonedToUtcIso('2026-07-01', '12:00', 'Europe/Berlin')).toBe('2026-07-01T10:00:00.000Z');
    expect(zonedToUtcIso('2026-12-01', '12:00', 'Europe/Berlin')).toBe('2026-12-01T11:00:00.000Z');
  });

  it('does calendar arithmetic', () => {
    expect(addDaysToDateString('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDateString('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMinutesToTime('19:00', 120)).toBe('21:00');
    expect(addMinutesToTime('23:00', 120)).toBe('23:59');
  });
});
