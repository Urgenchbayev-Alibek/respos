import { useEffect, useState } from 'react';
import { fetchPublicPlans, type PublicPlan } from '@/shared/api/publicApi';

export type PlansState =
  | { status: 'loading'; plans: [] }
  | { status: 'ready'; plans: PublicPlan[] }
  | { status: 'unavailable'; plans: [] };

/**
 * Loads informational plan limits from `GET /public/plans`.
 * Any failure is non-fatal: the page falls back to the static plan descriptions.
 */
export function usePublicPlans(): PlansState {
  const [state, setState] = useState<PlansState>({ status: 'loading', plans: [] });

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicPlans(controller.signal)
      .then((plans) => {
        setState(Array.isArray(plans) ? { status: 'ready', plans } : { status: 'unavailable', plans: [] });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'unavailable', plans: [] });
      });
    return () => controller.abort();
  }, []);

  return state;
}
