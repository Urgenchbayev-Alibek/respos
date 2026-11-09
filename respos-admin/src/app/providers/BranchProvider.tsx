import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { sessionStore } from '@/shared/api/session-store';
import { useAuth } from '@/shared/hooks/use-auth';
import { BranchContext, type BranchContextValue } from '@/shared/hooks/use-current-branch';

/**
 * Resolves the current branch from MeDto.branches (stored choice if still allowed, else the first).
 * The id is written to sessionStore during render so the very first child query already sends X-Branch-Id.
 */
export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(() => sessionStore.getBranchId());
  const branches = useMemo(() => user?.branches ?? [], [user]);
  const branch = branches.find((item) => item.id === selectedId) ?? branches[0] ?? null;

  if (user && (branch?.id ?? null) !== sessionStore.getBranchId()) {
    sessionStore.setBranchId(branch?.id ?? null);
  }

  const setBranch = useCallback(
    (branchId: string) => {
      if (branchId === sessionStore.getBranchId()) return;
      sessionStore.setBranchId(branchId);
      setSelectedId(branchId);
      void queryClient.cancelQueries();
      void queryClient.resetQueries();
    },
    [queryClient],
  );

  const value = useMemo<BranchContextValue>(() => ({ branch, branches, setBranch }), [branch, branches, setBranch]);
  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}
