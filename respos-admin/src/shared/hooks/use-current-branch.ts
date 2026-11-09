import { createContext, useContext } from 'react';
import type { MeDto } from '@/shared/types/api-response';

export type BranchRef = MeDto['branches'][number];

export interface BranchContextValue {
  /** null when the user has no branch access in the current org (or platform-only session). */
  branch: BranchRef | null;
  branches: BranchRef[];
  /** Switches X-Branch-Id, resets branch-scoped queries and rejoins the realtime branch group. */
  setBranch: (branchId: string) => void;
}

export const BranchContext = createContext<BranchContextValue | null>(null);

/** Current branch (drives `X-Branch-Id`, timezone for dates). Provided by app/providers/BranchProvider. */
export function useCurrentBranch(): BranchContextValue {
  const value = useContext(BranchContext);
  if (!value) throw new Error('useCurrentBranch must be used inside <BranchProvider>');
  return value;
}
