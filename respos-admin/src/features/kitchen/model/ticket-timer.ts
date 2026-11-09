import type { KitchenTicketDto } from '@/entities/kitchen-ticket/kitchen-ticket.types';

/** KDS waiting-time thresholds (SCREEN_INVENTORY §11): > 10 min warning, > 20 min danger. */
export const TIMER_THRESHOLDS_MIN = { warning: 10, danger: 20 } as const;

export type TimerLevel = 'normal' | 'warning' | 'danger';

const MINUTE_MS = 60_000;

export function getTimerLevel(elapsedMs: number): TimerLevel {
  if (elapsedMs > TIMER_THRESHOLDS_MIN.danger * MINUTE_MS) return 'danger';
  if (elapsedMs > TIMER_THRESHOLDS_MIN.warning * MINUTE_MS) return 'warning';
  return 'normal';
}

/** `mm:ss`, or `h:mm:ss` after an hour. Negative values (clock skew) show as 00:00. */
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** Waiting time: running for active tickets, frozen at `readyAt` once ready/served. */
export function getTicketElapsedMs(ticket: Pick<KitchenTicketDto, 'createdAt' | 'readyAt' | 'status'>, now: number): number {
  const createdAt = Date.parse(ticket.createdAt);
  const isActive = ticket.status === 'new' || ticket.status === 'in_progress';
  const end = !isActive && ticket.readyAt ? Date.parse(ticket.readyAt) : now;
  return end - createdAt;
}
