import { useEffect, useState } from 'react';

const DEFAULT_DELAY_MS = 300;

/** Debounces fast-changing values (search inputs) before they reach query keys. */
export function useDebouncedValue<T>(value: T, delayMs = DEFAULT_DELAY_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
