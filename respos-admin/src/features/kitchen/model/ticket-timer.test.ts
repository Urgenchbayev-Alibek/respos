import { describe, expect, it } from 'vitest';
import { formatElapsed, getTicketElapsedMs, getTimerLevel } from './ticket-timer';

const MIN = 60_000;

describe('ticket timer', () => {
  it('is normal up to and including 10 minutes', () => {
    expect(getTimerLevel(0)).toBe('normal');
    expect(getTimerLevel(10 * MIN)).toBe('normal');
  });

  it('warns after 10 minutes and is danger after 20 minutes', () => {
    expect(getTimerLevel(10 * MIN + 1000)).toBe('warning');
    expect(getTimerLevel(20 * MIN)).toBe('warning');
    expect(getTimerLevel(20 * MIN + 1000)).toBe('danger');
  });

  it('formats elapsed time as mm:ss and h:mm:ss', () => {
    expect(formatElapsed(72_000)).toBe('01:12');
    expect(formatElapsed(-5000)).toBe('00:00');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
  });

  it('runs for active tickets and freezes at readyAt', () => {
    const now = Date.parse('2026-11-10T12:30:00Z');
    const createdAt = '2026-11-10T12:00:00Z';
    expect(getTicketElapsedMs({ createdAt, readyAt: null, status: 'in_progress' }, now)).toBe(30 * MIN);
    expect(getTicketElapsedMs({ createdAt, readyAt: '2026-11-10T12:12:00Z', status: 'ready' }, now)).toBe(12 * MIN);
  });
});
