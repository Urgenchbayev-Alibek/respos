import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { ConnectionState, RealtimeEventMap, RealtimeEventName } from './events';
import { hubManager } from './hub-manager';

/**
 * Subscribes to a server event for the lifetime of the component.
 * Typical handler: `queryClient.invalidateQueries({ queryKey: ordersKeys.all })` — do NOT patch cache from payload.
 */
export function useRealtimeEvent<K extends RealtimeEventName>(
  name: K,
  handler: (payload: RealtimeEventMap[K]) => void,
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => hubManager.on(name, (payload) => handlerRef.current(payload)), [name]);
}

/** Connection state for status indicators (KDS "offline" banner etc.). */
export function useRealtimeStatus(): ConnectionState {
  return useSyncExternalStore(
    (listener) => hubManager.subscribeState(listener),
    hubManager.getState,
    hubManager.getState,
  );
}
