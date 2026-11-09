import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/shared/hooks/use-auth';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { hubManager } from '@/shared/realtime';

/**
 * Keeps ONE hub connection for the signed-in user + current branch.
 * After every reconnect all queries are invalidated (events may have been missed while offline).
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { branch } = useCurrentBranch();
  const queryClient = useQueryClient();
  const branchId = branch?.id ?? null;

  useEffect(() => {
    if (status !== 'authenticated' || !branchId) {
      void hubManager.stop();
      return;
    }
    void hubManager.start(branchId);
  }, [status, branchId]);

  useEffect(() => hubManager.onReconnected(() => void queryClient.invalidateQueries()), [queryClient]);
  useEffect(() => () => void hubManager.stop(), []);

  return <>{children}</>;
}
