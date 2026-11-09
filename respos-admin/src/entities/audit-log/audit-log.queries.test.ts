import { describe, expect, it } from 'vitest';
import { auditDateRange } from './audit-log.queries';

describe('auditDateRange', () => {
  it('turns date inputs into inclusive UTC instants in the branch timezone', () => {
    expect(auditDateRange('2026-11-10', '2026-11-10', 'Asia/Tashkent')).toEqual({
      from: '2026-11-09T19:00:00.000Z',
      to: '2026-11-10T18:59:59.999Z',
    });
  });

  it('omits empty bounds', () => {
    expect(auditDateRange('', '', 'Asia/Tashkent')).toEqual({ from: undefined, to: undefined });
  });
});
