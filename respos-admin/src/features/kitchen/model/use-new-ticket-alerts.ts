import { useEffect, useRef, useState } from 'react';
import type { KitchenTicketDto } from '@/entities/kitchen-ticket/kitchen-ticket.types';

const HIGHLIGHT_MS = 15_000;

/**
 * Detects tickets that were not in the previous server response (new event, reconnect refetch…)
 * and highlights them for a while; calls `onNew` once per batch. The first load never alerts.
 * `resetKey` (station/filter) starts a fresh baseline.
 */
export function useNewTicketAlerts(
  tickets: KitchenTicketDto[] | undefined,
  resetKey: string,
  onNew: () => void,
): ReadonlySet<string> {
  const known = useRef<Set<string> | null>(null);
  const onNewRef = useRef(onNew);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    onNewRef.current = onNew;
  });

  useEffect(() => {
    known.current = null;
    setHighlighted(new Set());
  }, [resetKey]);

  useEffect(() => {
    if (!tickets) return;
    const ids = tickets.map((ticket) => ticket.id);
    const previous = known.current;
    known.current = new Set(ids);
    if (!previous) return;
    const fresh = tickets.filter((ticket) => ticket.status === 'new' && !previous.has(ticket.id)).map((t) => t.id);
    if (fresh.length === 0) return;
    setHighlighted((current) => new Set([...current, ...fresh]));
    onNewRef.current();
    timers.current.push(
      setTimeout(() => {
        setHighlighted((current) => new Set([...current].filter((id) => !fresh.includes(id))));
      }, HIGHLIGHT_MS),
    );
  }, [tickets]);

  return highlighted;
}
