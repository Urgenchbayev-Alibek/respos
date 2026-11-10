import { describe, expect, it } from 'vitest';
import { boardColumnOf, telLink } from '@/entities/delivery/delivery.types';
import { tableMenuUrl } from '@/features/qr-menu/model/qr';
import { minutesSince } from './delivery-form';

describe('delivery helpers', () => {
  it('groups closed statuses into the done column', () => {
    expect(boardColumnOf('delivered')).toBe('done');
    expect(boardColumnOf('cancelled')).toBe('done');
    expect(boardColumnOf('on_the_way')).toBe('on_the_way');
  });

  it('counts whole minutes and never goes negative', () => {
    const now = Date.parse('2026-11-10T10:00:00Z');
    expect(minutesSince('2026-11-10T09:30:30Z', now)).toBe(29);
    expect(minutesSince('2026-11-10T10:05:00Z', now)).toBe(0);
  });

  it('builds tel: and QR menu links', () => {
    expect(telLink('+998 90 123-45-67')).toBe('tel:+998901234567');
    expect(tableMenuUrl('https://respos.uz', 'cafe-1', 'VIP 2')).toBe('https://respos.uz/menu/cafe-1?table=VIP+2');
  });
});
