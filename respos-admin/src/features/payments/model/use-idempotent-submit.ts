import { useCallback, useRef, useState } from 'react';
import { isApiError } from '@/shared/api/api-error';
import { useIdempotencyKey } from '@/shared/api/idempotency';

/**
 * Outcome unknown (network failure, timeout, 5xx): the server may have processed the request,
 * so a retry MUST reuse the same Idempotency-Key to get the stored response instead of paying twice.
 */
export function isUncertainFailure(error: unknown): boolean {
  if (!isApiError(error)) return true;
  return error.status === 0 || error.status === 408 || error.status >= 500;
}

export interface IdempotentSubmit<TArgs, TResult> {
  /** Resolves to `undefined` when ignored because a submit is already running (double click). */
  submit: (args: TArgs) => Promise<TResult | undefined>;
  pending: boolean;
  /** Current key (exposed for diagnostics/tests). */
  idempotencyKey: string;
  /** Start a new user action (e.g. another order selected). */
  reset: () => void;
}

/**
 * One Idempotency-Key per user action, guarded against double submit:
 * - reused on retry after an uncertain failure;
 * - renewed after success, and after a definitive 4xx (the corrected request is a new action —
 *   reusing the key would replay the stored error).
 */
export function useIdempotentSubmit<TArgs, TResult>(
  run: (args: TArgs, idempotencyKey: string) => Promise<TResult>,
): IdempotentSubmit<TArgs, TResult> {
  const { key, renew } = useIdempotencyKey();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);

  const submit = useCallback(
    async (args: TArgs) => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setPending(true);
      try {
        const result = await run(args, key);
        renew();
        return result;
      } catch (error) {
        if (!isUncertainFailure(error)) renew();
        throw error;
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [run, key, renew],
  );

  return { submit, pending, idempotencyKey: key, reset: renew };
}
